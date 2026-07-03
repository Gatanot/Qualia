import process from 'node:process';
import type { AppConfig } from '@gatanot/qualia_core/config';
import {
	readConfig,
	getProviderForModel,
	getContextWindow,
	getActiveModel,
} from '@gatanot/qualia_core/config';
import { createProvider } from '@gatanot/qualia_core/ai';
import type { Usage } from '@gatanot/qualia_core/ai';
import { createStorage } from '@gatanot/qualia_core/storage';
import type { Storage } from '@gatanot/qualia_core/storage';
import { ToolRegistry, CORE_TOOLS, SCHEDULING_TOOLS, createSearchHistoryTool } from '@gatanot/qualia_core/tool';
import { AgentLoop, ContextBuilder } from '@gatanot/qualia_core/agent';
import type { AgentEvent, ConfirmFn, BuildResult } from '@gatanot/qualia_core/agent';
import { sessionLock } from '@gatanot/qualia_core/concurrency';

export interface AgentRunOptions {
	message: string;
	sessionId?: string;
	workspace?: string;
	modelId?: string;
	systemPrompt?: string;
	signal?: AbortSignal;
	onConfirm: ConfirmFn;
	onEvent: (event: AgentEvent) => void | Promise<void>;
}

export interface AgentRunResult {
	sessionId: string;
	doneMessageId?: string;
	usage?: Usage;
	forkedSessionId?: string;
}

export class AgentRunner {
	private config: AppConfig;
	private storage: Storage;
	private registry: ToolRegistry;

	constructor() {
		this.config = readConfig();
		this.storage = createStorage({ enabled: this.config.storageEnabled });
		this.registry = new ToolRegistry();
		for (const t of CORE_TOOLS) this.registry.register(t);
		for (const t of SCHEDULING_TOOLS) this.registry.register(t);
		this.registry.register(createSearchHistoryTool(this.storage));
	}

	validate(): { ok: boolean; error?: string } {
		if (!this.config.activeModel && !this.config.providers.length) {
			return { ok: false, error: '未配置模型。请先运行 qualia serve 然后在 settings 中配置。' };
		}
		return { ok: true };
	}

	async createSession(workspace?: string): Promise<string> {
		const session = await this.storage.createSession(undefined, undefined, workspace);
		return session.id;
	}

	async run(opts: AgentRunOptions): Promise<AgentRunResult> {
		const modelId = opts.modelId || this.config.activeModel;
		if (!modelId) {
			throw new Error('未选择模型');
		}

		const providerConfig = getProviderForModel(modelId);
		if (!providerConfig) {
			throw new Error(`未找到模型 ${modelId} 的供应商配置`);
		}

		const model = getActiveModel();
		if (!model) {
			throw new Error('未找到可用模型');
		}

		const runtimeConfig = {
			...providerConfig,
			activeModel: model.id,
			contextWindow: model.contextWindow,
		};
		const provider = createProvider(runtimeConfig);
		const contextBuilder = new ContextBuilder();
		const contextWindow = getContextWindow();
		const workspace = opts.workspace || process.cwd();

		let sid = opts.sessionId;
		if (!sid) {
			const session = await this.storage.createSession(undefined, undefined, workspace);
			sid = session.id;
		} else {
			const exists = await this.storage.getSession(sid);
			if (!exists) {
				const session = await this.storage.createSession(undefined, undefined, workspace);
				sid = session.id;
			}
		}

		const buildResult = await contextBuilder.build(
			sid,
			opts.message,
			[],
			this.storage,
			contextWindow,
			opts.systemPrompt || this.config.systemPrompt,
		);

		const agent = new AgentLoop(
			provider,
			this.storage,
			this.registry,
			opts.onConfirm,
			opts.signal,
			undefined,
			this.config.compressionMode,
			this.config.compressionThreshold,
		);

		const result: AgentRunResult = { sessionId: sid };

		let release: (() => void) | undefined;
		try {
			release = await sessionLock.acquire(sid);

			for await (const event of agent.run(sid, opts.message, buildResult)) {
				if (event.type === 'done') {
					result.doneMessageId = event.messageId;
					result.usage = event.usage;
				} else if (event.type === 'forked') {
					result.forkedSessionId = event.newSessionId;
				}
				await opts.onEvent(event);
			}
		} finally {
			if (release) release();
		}

		return result;
	}
}
