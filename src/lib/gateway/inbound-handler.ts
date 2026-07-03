import { readConfig, getProviderForModel, getActiveModel, getContextWindow } from '$lib/config';
import { createProvider } from '$lib/ai';
import { createStorage } from '$lib/storage';
import { ToolRegistry, CORE_TOOLS, SCHEDULING_TOOLS, createSearchHistoryTool } from '$lib/tool';
import { AgentLoop, ContextBuilder, AgentLogger } from '$lib/agent';
import { sessionLock } from '$lib/concurrency';
import { getBoundSession, setBoundSession } from './adapters/telegram-sessions';
import type { InboundHandler } from './dispatcher';

export function createInboundHandler(): InboundHandler {
	return async (msg, adapter, reply) => {
		console.log(`[gateway] inbound from ${adapter.name} chat ${msg.chatId}: "${msg.text.slice(0, 50)}"`);
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

			const agent = new AgentLoop(provider, storage, registry, async () => false, undefined, new AgentLogger(sessionId), cfg.compressionMode, cfg.compressionThreshold);

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
	};
}
