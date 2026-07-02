import { readConfig, getProviderForModel, getActiveModel, getContextWindow } from '$lib/config';
import { createProvider } from '$lib/ai';
import { createStorage } from '$lib/storage';
import { ToolRegistry, CORE_TOOLS, SCHEDULING_TOOLS, createSearchHistoryTool } from '$lib/tool';
import { AgentLoop, ContextBuilder, AgentLogger } from '$lib/agent';
import type { BuildResult } from '$lib/agent';
import { runSummarizeJob } from '$lib/agent/background';
import { GatewayDispatcher, EmailAdapter, TelegramAdapter } from '$lib/gateway';
import type { EmailConfig, TelegramConfig, GatewayNotification } from '$lib/gateway';
import { getBoundSession, setBoundSession, getAllChatIds } from '$lib/gateway';
import { startScheduler, stopScheduler, setTaskNotificationHandler } from '$lib/task';
import { BackgroundWorker, sessionLock } from '$lib/concurrency';

let lastScheduledDate = '';
let summarizeWorker: BackgroundWorker | null = null;
let gateway: GatewayDispatcher | null = null;

function getToday(): string {
	const d = new Date();
	return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

async function notifyAll(notification: GatewayNotification): Promise<void> {
	if (!gateway) return;

	await gateway.notify(notification, { adapterFilter: (a) => a.name !== 'telegram' });

	const text = `**${notification.title}**\n\n${notification.body}`;
	for (const chatId of getAllChatIds()) {
		await gateway.send('telegram', chatId, text);
	}
}

async function initGateway(): Promise<void> {
	const config = readConfig();
	gateway = new GatewayDispatcher();

	const emailConfig: EmailConfig = {
		smtpHost: config.emailSmtpHost,
		smtpPort: config.emailSmtpPort,
		smtpSecure: config.emailSmtpSecure,
		user: config.emailSmtpUser,
		password: config.emailSmtpPass,
		from: config.emailFrom,
		to: config.emailTo
	};

	if (config.emailNotifications && emailConfig.smtpHost && emailConfig.user && emailConfig.to) {
		const email = new EmailAdapter(emailConfig);
		gateway.register(email);
	}

	if (config.telegramBotToken) {
		const tgConfig: TelegramConfig = {
			botToken: config.telegramBotToken,
			allowedUsers: config.telegramAllowedUsers || ''
		};
		const telegram = new TelegramAdapter(tgConfig);
		gateway.register(telegram);
	}

	if (gatewayHasAdapters()) {
			gateway.onInbound(async (msg, _adapter, reply) => {
				console.log(`[gateway] inbound from ${_adapter.name} chat ${msg.chatId}: "${msg.text.slice(0, 50)}"`);
				let release: (() => void) | undefined;
				try {
					const cfg = readConfig();
					if (!cfg.activeModel) {
						console.log('[gateway] no active model configured');
						await reply('未配置 AI 模型，请先在 Qualia 设置中添加供应商。');
						return;
					}

					const providerConfig = getProviderForModel(cfg.activeModel);
					if (!providerConfig) {
						console.log('[gateway] provider config not found');
						await reply('未找到对应模型的供应商配置。');
						return;
					}

					const model = getActiveModel();
					const runtimeConfig = { ...providerConfig, activeModel: model?.id || cfg.activeModel, contextWindow: model?.contextWindow || 1_048_576 };
					const provider = createProvider(runtimeConfig);
					const storage = createStorage({ enabled: cfg.storageEnabled });

					let sessionId = getBoundSession(msg.chatId);
					console.log(`[gateway] resolved session: ${sessionId || '(null)'}`);
					if (!sessionId) {
						const recent = await storage.getMostRecentSession();
						if (recent) {
							sessionId = recent.id;
						} else {
							const session = await storage.createSession();
							sessionId = session.id;
						}
						setBoundSession(msg.chatId, sessionId);
					} else {
						const exists = await storage.getSession(sessionId);
						if (!exists) {
							const recent = await storage.getMostRecentSession();
							if (recent) {
								sessionId = recent.id;
							} else {
								const session = await storage.createSession();
								sessionId = session.id;
							}
							setBoundSession(msg.chatId, sessionId);
						}
					}
					console.log(`[gateway] using session: ${sessionId}`);

					release = await sessionLock.acquire(sessionId);

				const registry = new ToolRegistry();
				for (const t of CORE_TOOLS) registry.register(t);
				for (const t of SCHEDULING_TOOLS) registry.register(t);
				registry.register(createSearchHistoryTool(storage));

				const contextBuilder = new ContextBuilder();
				const buildResult = await contextBuilder.build(
					sessionId,
					msg.text,
					[],
					storage,
					getContextWindow(),
					cfg.systemPrompt
				);

					const agent = new AgentLoop(provider, storage, registry, async () => false, undefined, new AgentLogger(sessionId));

					let fullText = '';
					let forkedId: string | undefined;

					console.log('[gateway] starting AgentLoop');
					for await (const event of agent.run(sessionId, msg.text, buildResult)) {
						if (event.type === 'content') {
							fullText += event.text;
						} else if (event.type === 'forked') {
							forkedId = event.newSessionId;
						}
					}
					console.log(`[gateway] AgentLoop done, response length: ${fullText.length}, forked: ${forkedId || 'none'}`);

					if (forkedId) {
						setBoundSession(msg.chatId, forkedId);
					}

					const response = fullText.trim() || '(无输出)';
					await reply(response);
				} catch (e) {
					console.error('[gateway] inbound error:', (e as Error).message);
					await reply(`错误: ${(e as Error).message}`);
				} finally {
					if (release) release();
				}
			});

		await gateway.start();
	}
}

function gatewayHasAdapters(): boolean {
	return gateway !== null;
}

async function summarizeTick(): Promise<void> {
	const config = readConfig();
	if (!config.autoSummarize) return;

	let result: { summarized: number; diary: boolean } | undefined;

	if (config.summaryMode === 'scheduled') {
		const now = new Date();
		const today = getToday();
		if (now.getHours() >= (config.summaryScheduleHour || 2) && today !== lastScheduledDate) {
			lastScheduledDate = today;
			result = await runSummarizeJob(false, null);
		}
	} else {
		result = await runSummarizeJob();
	}

	if (result) {
		const { summarized, diary } = result;
		if (summarized > 0 || diary) {
			const parts: string[] = [];
			if (summarized > 0) parts.push(`已为 ${summarized} 个对话生成摘要`);
			if (diary) parts.push('已生成日记条目');
			await notifyAll({
				title: 'Qualia 任务完成',
				body: parts.join('\n'),
				type: 'task_complete'
			});
		}
	}
}

function startSummarizeWorker(): void {
	const config = readConfig();
	if (!config.autoSummarize) return;

	const intervalMin = config.summaryIntervalMin || 30;
	summarizeWorker = new BackgroundWorker();
	summarizeWorker.schedule('summarize', intervalMin * 60 * 1000, summarizeTick);
	summarizeWorker.start();
}

export { gateway };

function cleanup() {
	if (summarizeWorker) {
		summarizeWorker.stop();
		summarizeWorker = null;
	}
	stopScheduler();
	if (gateway) {
		gateway.stop();
		gateway = null;
	}
}

setTaskNotificationHandler(async (notification) => {
	await notifyAll(notification);
});

initGateway();
runBackgroundTasks();
startScheduler();

async function runBackgroundTasks() {
	await summarizeTick();
	startSummarizeWorker();
}

if (import.meta.hot) {
	import.meta.hot.dispose(() => {
		cleanup();
	});
}
