import { readConfig, getProviderForModel, getActiveModel, getContextWindow } from '$lib/config';
import { createProvider } from '$lib/ai';
import { createStorage } from '$lib/storage';
import { ToolRegistry, readFileTool, writeFileTool, deleteFileTool, editTool, execTool, writeMemoryTool, webSearchTool, readMemoryTool, createSearchHistoryTool, scheduleTaskTool, readTasksTool } from '$lib/tool';
import { AgentLoop, ContextBuilder } from '$lib/agent';
import type { BuildResult } from '$lib/agent';
import { runSummarizeJob } from '$lib/agent/background';
import { GatewayDispatcher, EmailAdapter, TelegramAdapter } from '$lib/gateway';
import type { EmailConfig, TelegramConfig } from '$lib/gateway';
import { getBoundSession, setBoundSession } from '$lib/gateway';
import { startScheduler, stopScheduler, setTaskNotificationHandler } from '$lib/task';

let running = false;
let lastScheduledDate = '';
let timerId: ReturnType<typeof setTimeout> | null = null;
let gateway: GatewayDispatcher | null = null;

function getToday(): string {
	const d = new Date();
	return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
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
		setupInboundHandler();

		gateway.onInbound(async (msg, _adapter, reply) => {
			try {
				const cfg = readConfig();
				if (!cfg.activeModel) {
					await reply('未配置 AI 模型，请先在 Qualia 设置中添加供应商。');
					return;
				}

				const providerConfig = getProviderForModel(cfg.activeModel);
				if (!providerConfig) {
					await reply('未找到对应模型的供应商配置。');
					return;
				}

				const model = getActiveModel();
				const runtimeConfig = { ...providerConfig, activeModel: model?.id || cfg.activeModel, contextWindow: model?.contextWindow || 1_048_576 };
				const provider = createProvider(runtimeConfig);
				const storage = createStorage({ enabled: cfg.storageEnabled });

				let sessionId = getBoundSession(msg.chatId);
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

				const registry = new ToolRegistry();
				registry.register(readFileTool);
				registry.register(writeFileTool);
				registry.register(deleteFileTool);
				registry.register(editTool);
				registry.register(execTool);
				registry.register(writeMemoryTool);
				registry.register(webSearchTool);
				registry.register(readMemoryTool);
				registry.register(createSearchHistoryTool(storage));
				registry.register(scheduleTaskTool);
				registry.register(readTasksTool);

				const contextBuilder = new ContextBuilder();
				const buildResult = await contextBuilder.build(
					sessionId,
					msg.text,
					[],
					storage,
					registry,
					getContextWindow(),
					cfg.systemPrompt
				);

				const agent = new AgentLoop(provider, storage, registry, async () => false);

				let fullText = '';
				let forkedId: string | undefined;

				for await (const event of agent.run(sessionId, msg.text, buildResult)) {
					if (event.type === 'content') {
						fullText += event.text;
					} else if (event.type === 'forked') {
						forkedId = event.newSessionId;
					}
				}

				if (forkedId) {
					setBoundSession(msg.chatId, forkedId);
				}

				const response = fullText.trim() || '(无输出)';
				await reply(response);
			} catch (e) {
				await reply(`错误: ${(e as Error).message}`);
			}
		});

		await gateway.start();
	}
}

function gatewayHasAdapters(): boolean {
	if (!gateway) return false;
	return true;
}

function setupInboundHandler(): void {
	// handler is set in initGateway via gateway.onInbound()
}

async function runBackgroundTasks() {
	if (running) return;
	running = true;

	try {
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

		if (result && gateway) {
			const { summarized, diary } = result;
			if (summarized > 0 || diary) {
				const parts: string[] = [];
				if (summarized > 0) parts.push(`已为 ${summarized} 个对话生成摘要`);
				if (diary) parts.push('已生成日记条目');
				await gateway.notify({
					title: 'Qualia 任务完成',
					body: parts.join('\n'),
					type: 'task_complete'
				});
			}
		}
	} catch {
	} finally {
		running = false;

		const config = readConfig();
		if (config.autoSummarize) {
			const intervalMin = config.summaryIntervalMin || 30;
			timerId = setTimeout(runBackgroundTasks, intervalMin * 60 * 1000);
		}
	}
}

export { gateway };

function cleanup() {
	if (timerId) {
		clearTimeout(timerId);
		timerId = null;
	}
	running = false;
	stopScheduler();
	if (gateway) {
		gateway.stop();
		gateway = null;
	}
}

setTaskNotificationHandler(async (notification) => {
	if (gateway) {
		await gateway.notify(notification);
	}
});

initGateway();
runBackgroundTasks();
startScheduler();

if (import.meta.hot) {
	import.meta.hot.dispose(() => {
		cleanup();
	});
}
