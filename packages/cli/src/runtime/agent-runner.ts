import { randomUUID } from 'node:crypto';
import { AgentLoop, ContextBuilder, type AgentEvent, type ConfirmFn } from '@gatanot/qualia_core/agent';
import { createProvider } from '@gatanot/qualia_core/ai';
import { createStorage, type Storage } from '@gatanot/qualia_core/storage';
import {
	CORE_TOOLS,
	SCHEDULING_TOOLS,
	ToolRegistry,
	createSearchHistoryTool
} from '@gatanot/qualia_core/tool';
import { sessionLock } from '@gatanot/qualia_core/concurrency';
import { CliError } from '../errors.js';
import { loadRuntimeConfig } from './config-loader.js';

export interface AgentRunOptions {
	workspace: string;
	message: string;
	sessionId?: string;
	newSession?: boolean;
	modelId?: string;
	storageEnabled?: boolean;
	systemPrompt?: string;
	signal?: AbortSignal;
	onConfirm: ConfirmFn;
	onEvent(event: AgentEvent): Promise<void> | void;
}

export interface AgentRunResult {
	sessionId: string;
	doneMessageId?: string;
	forkedSessionId?: string;
	content: string;
	reasoning: string;
}

export class AgentRunner {
	async run(options: AgentRunOptions): Promise<AgentRunResult> {
		const runtime = loadRuntimeConfig({
			modelId: options.modelId,
			storageEnabled: options.storageEnabled
		});

		const provider = createProvider({
			...runtime.provider,
			activeModel: runtime.activeModelId,
			contextWindow: runtime.contextWindow
		});
		const storage = createStorage({ enabled: runtime.storageEnabled });
		const registry = createRegistry(storage);
		const contextBuilder = new ContextBuilder();

		const sessionId = await this.resolveSessionId(storage, options);
		const buildResult = await contextBuilder.build(
			sessionId,
			options.message,
			[],
			storage,
			runtime.contextWindow,
			options.systemPrompt ?? runtime.app.systemPrompt
		);

		const agent = new AgentLoop(
			provider,
			storage,
			registry,
			options.onConfirm,
			options.signal,
			undefined,
			runtime.app.compressionMode,
			runtime.app.compressionThreshold
		);

		let release: (() => void) | undefined;
		let content = '';
		let reasoning = '';
		let doneMessageId: string | undefined;
		let forkedSessionId: string | undefined;

		try {
			release = await sessionLock.acquire(sessionId);
			for await (const event of agent.run(sessionId, options.message, buildResult, randomUUID())) {
				if (event.type === 'content') content += event.text;
				if (event.type === 'reasoning') reasoning += event.text;
				if (event.type === 'done') doneMessageId = event.messageId;
				if (event.type === 'forked') forkedSessionId = event.newSessionId;
				await options.onEvent(event);
			}
		} catch (error) {
			if (options.signal?.aborted) {
				throw new CliError('CANCELLED', '运行已取消', { cause: error });
			}
			throw new CliError('AGENT', (error as Error).message || 'Agent 运行失败', { cause: error });
		} finally {
			if (release) release();
		}

		return {
			sessionId: forkedSessionId || sessionId,
			doneMessageId,
			forkedSessionId,
			content,
			reasoning
		};
	}

	private async resolveSessionId(storage: Storage, options: AgentRunOptions): Promise<string> {
		if (options.newSession) {
			const session = await storage.createSession(undefined, options.workspace);
			return session.id;
		}
		if (options.sessionId) {
			const existing = await storage.getSession(options.sessionId);
			if (existing) return existing.id;
			throw new CliError('USAGE', `会话不存在：${options.sessionId}`);
		}

		const session = await storage.createSession(undefined, options.workspace);
		return session.id;
	}
}

function createRegistry(storage: Storage): ToolRegistry {
	const registry = new ToolRegistry();
	for (const tool of CORE_TOOLS) registry.register(tool);
	for (const tool of SCHEDULING_TOOLS) registry.register(tool);
	registry.register(createSearchHistoryTool(storage));
	return registry;
}
