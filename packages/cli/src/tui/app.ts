import process from 'node:process';

import {
	readConfig,
	getProviderForModel,
	getContextWindow,
	getActiveModel
} from '@gatanot/qualia_core/config';
import { createProvider } from '@gatanot/qualia_core/ai';
import { createStorage } from '@gatanot/qualia_core/storage';
import { ToolRegistry, CORE_TOOLS, SCHEDULING_TOOLS, createSearchHistoryTool } from '@gatanot/qualia_core/tool';
import { AgentLoop, ContextBuilder } from '@gatanot/qualia_core/agent';
import type { AgentEvent, ConfirmFn } from '@gatanot/qualia_core/agent';
import { sessionLock } from '@gatanot/qualia_core/concurrency';

import { Terminal } from './terminal.js';
import { ChatView } from './view.js';
import { ConfirmHandler } from './confirm.js';
import { Editor } from './editor.js';

export class TUIApp {
	private term: Terminal;
	private view: ChatView;
	private confirm: ConfirmHandler;
	private editor: Editor;
	private sessionId?: string;
	private workspace: string;
	private activeChildPid: number | null = null;
	private escCount = 0;
	private abortController: AbortController | null = null;

	constructor(workspace?: string) {
		this.workspace = workspace || process.cwd();
		this.term = new Terminal();
		this.view = new ChatView(this.term);
		this.confirm = new ConfirmHandler(this.term);
		this.editor = new Editor();
	}

	async start(): Promise<void> {
		const config = readConfig();

		if (!config.activeModel) {
			console.log('未配置模型。请先运行 qualia serve 然后在 http://localhost:5173/settings 中配置。');
			process.exit(1);
		}

		const model = getActiveModel();
		if (!model) {
			console.log('未找到可用模型。');
			process.exit(1);
		}

		this.term.enterRawMode();
		try {
			this.term.write('\x1b[2J');
			this.view.addHeader(`Qualia · ${model.name} · ${this.workspace}`);

			this.term.onResize((w, h) => {
				this.view.renderFull();
			});

			this.view.renderFull();

			const storage = createStorage({ enabled: config.storageEnabled });
			if (config.storageEnabled) {
				const session = await storage.createSession(undefined, undefined, this.workspace);
				this.sessionId = session.id;
			}

			await this.chatLoop(config, model, storage);
		} finally {
			this.term.dispose();
		}
	}

	private async chatLoop(config: ReturnType<typeof readConfig>, model: ReturnType<typeof getActiveModel>, storage: ReturnType<typeof createStorage>): Promise<void> {
		while (true) {
			this.view.statusText = '';
			this.view.renderFull();

			const message = await this.editor.waitForInput(this.term);
			const trimmed = message.trim();
			if (trimmed === '/exit' || trimmed === '/quit') break;
			if (!trimmed) continue;

			this.view.addMessage('user', trimmed);
			this.view.renderFull();

			const providerConfig = getProviderForModel(model!.id);
			if (!providerConfig) {
				this.view.addMessage('assistant', '错误：未找到对应模型的供应商配置。');
				this.view.renderFull();
				continue;
			}

			const runtimeConfig = { ...providerConfig, activeModel: model!.id, contextWindow: model!.contextWindow };
			const provider = createProvider(runtimeConfig);

			const registry = new ToolRegistry();
			for (const t of CORE_TOOLS) registry.register(t);
			for (const t of SCHEDULING_TOOLS) registry.register(t);
			registry.register(createSearchHistoryTool(storage));

			const contextBuilder = new ContextBuilder();
			const contextWindow = getContextWindow();

			const onConfirm: ConfirmFn = async (conf, confirmId) => {
				const msg = conf.reason || `执行 ${conf.toolName || '未知操作'}？`;
				const approved = await this.confirm.prompt(msg);
				this.view.renderFull();
				return approved;
			};

			this.abortController = new AbortController();
			this.escCount = 0;
			this.view.statusText = 'ESC: interrupt  Ctrl+C: exit';
			this.view.render();

			const streamKeyHandler = (buf: Buffer): boolean => {
				if (buf[0] === 0x1B) {
					this.escCount++;
					if (this.escCount === 1) {
						this.view.statusText = 'Press ESC again to interrupt';
						this.view.render();
					} else {
						this.doInterrupt();
						this.view.statusText = '';
					}
					return true;
				}
				if (buf[0] === 0x03) {
					this.escCount += 2;
					if (this.escCount >= 3) {
						this.term.dispose();
						process.exit(0);
					} else {
						this.doInterrupt();
						this.view.statusText = '';
					}
					return true;
				}
				return false;
			};

			this.term.addRawListener(streamKeyHandler);

			const agent = new AgentLoop(
				provider,
				storage,
				registry,
				onConfirm,
				this.abortController.signal,
				undefined,
				config.compressionMode,
				config.compressionThreshold,
			);

			let sid = this.sessionId;
			if (!sid) {
				const session = await storage.createSession(undefined, undefined, this.workspace);
				sid = session.id;
				this.sessionId = sid;
			} else {
				const exists = await storage.getSession(sid);
				if (!exists) {
					const session = await storage.createSession(undefined, undefined, this.workspace);
					sid = session.id;
					this.sessionId = sid;
				}
			}

			const buildResult = await contextBuilder.build(sid, trimmed, [], storage, contextWindow, config.systemPrompt);

			let release: (() => void) | undefined;
			try {
				release = await sessionLock.acquire(sid);
				this.view.beginAssistant();

				for await (const event of agent.run(sid, trimmed, buildResult)) {
					await this.handleEvent(event);
				}
			} catch (e) {
				this.view.addMessage('assistant', `错误：${(e as Error).message}`);
				this.view.renderFull();
			} finally {
				if (release) release();
			}

			this.term.removeRawListener(streamKeyHandler);
			this.abortController = null;
		}
	}

	private doInterrupt(): void {
		if (this.activeChildPid !== null) {
			try { process.kill(this.activeChildPid, 'SIGTERM'); } catch { /* */ }
			this.activeChildPid = null;
		} else {
			this.confirm.cancel();
			this.abortController?.abort();
		}
	}

	private async handleEvent(event: AgentEvent): Promise<void> {
		switch (event.type) {
			case 'content':
				this.view.appendStreaming(event.text);
				this.view.render();
				break;

			case 'reasoning':
				this.view.addReasoning(event.text);
				this.view.render();
				break;

			case 'tool_call':
				this.view.addToolCall(event.name, event.args);
				this.view.render();
				break;

			case 'tool_execution_update':
				this.view.appendToolOutput(event.text);
				this.view.render();
				break;

			case 'tool_result':
				this.view.addToolResult(event.name, event.success, event.output);
				this.view.render();
				break;

			case 'confirm_required':
				break;

			case 'done':
				this.view.finishStreaming();
				this.view.renderFull();
				break;

			case 'forked': {
				this.sessionId = event.newSessionId;
				this.view.addMessage('assistant', `对话已延续到新会话：${event.newSessionId}`);
				this.view.renderFull();
				break;
			}

			case 'retrying':
				break;

			case 'retry_exhausted':
				this.view.addMessage('assistant', `重试耗尽：${event.message}`);
				this.view.renderFull();
				break;

			case 'steering_consumed':
				break;

			case 'error':
				this.view.addMessage('assistant', `错误：${event.message}`);
				this.view.renderFull();
				break;
		}
	}
}
