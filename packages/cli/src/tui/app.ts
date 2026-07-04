import process from 'node:process';
import type { AgentEvent } from '@gatanot/qualia_core/agent';
import { createStorage, type MessageRecord } from '@gatanot/qualia_core/storage';
import { AgentRunner } from '../runtime/agent-runner.js';
import { loadRuntimeConfig } from '../runtime/config-loader.js';
import type { CliIO } from '../commands/index.js';
import { CliError } from '../errors.js';

import { Container, Editor, type EditorTheme, type SelectListTheme, ProcessTerminal, TUI } from './index.js';
import { getMarkdownTheme, theme } from './theme.js';
import { UserMessageComponent } from './user-message.js';
import { AssistantMessageComponent } from './assistant-message.js';
import { ToolExecutionComponent } from './tool-execution.js';
import { FooterComponent } from './footer.js';
import { StatusIndicator } from './status-indicator.js';
import { ConfirmInline } from './confirm-dialog.js';

const selectListTheme: SelectListTheme = {
	selectedPrefix: (t) => theme.fg('accent', t),
	selectedText: (t) => theme.fg('text', t),
	description: (t) => theme.fg('muted', t),
	scrollInfo: (t) => theme.fg('dim', t),
	noMatch: (t) => theme.fg('dim', t),
};

const editorTheme: EditorTheme = {
	borderColor: (t) => theme.fg('border', t),
	selectList: selectListTheme,
};

export interface TuiAppOptions {
	io: CliIO; workspace: string;
	sessionId?: string; newSession?: boolean; modelId?: string; storageEnabled?: boolean;
}

export class TuiApp {
	private readonly runner = new AgentRunner();
	private sessionId?: string;
	private abortController: AbortController | null = null;
	private ui: TUI;
	private chat = new Container();
	private statusContainer = new Container();
	private editor: Editor;
	private footer = new FooterComponent();

	private streaming: AssistantMessageComponent | null = null;
	private streamText = '';
	private streamReasoning = '';
	private pendingTools = new Map<string, ToolExecutionComponent>();
	private currentStatus: StatusIndicator | null = null;
	private sending = false;

	private mkTheme = getMarkdownTheme();
	private totalInput = 0;
	private totalOutput = 0;
	private contextWindow = 0;
	private modelId = '';
	private providerName = '';
	private confirmBar = new Container();
	private confirmResolver: ((approved: boolean) => void) | null = null;

	constructor(private readonly o: TuiAppOptions) {
		this.sessionId = o.newSession ? undefined : o.sessionId;
		const t = new ProcessTerminal();
		this.ui = new TUI(t);
		this.editor = new Editor(this.ui, editorTheme, { paddingX: 1 });
		this.editor.onSubmit = (v) => { this.submit(v); };
	}

	async start(): Promise<void> {
		if (!this.o.io.stdin.isTTY || !this.o.io.stdout.isTTY) {
			throw new CliError('USAGE', 'interactive TUI requires a TTY');
		}
		try {
			const rt = loadRuntimeConfig({ modelId: this.o.modelId, storageEnabled: this.o.storageEnabled });
			this.modelId = rt.activeModelId;
			this.contextWindow = rt.contextWindow;
			this.providerName = rt.provider.name;
		} catch { /* non-fatal */ }

		this.ui.addChild(this.chat);
		this.ui.addChild(this.statusContainer);
		this.ui.addChild(this.confirmBar);
		this.ui.addChild(this.editor);
		this.ui.addChild(this.footer);
		this.ui.setFocus(this.editor);

		this.ui.start();
		this.updateFooter();

		await this.loadHistory();
		if (this.chat.children.length > 0) this.ui.requestRender();
	}

	private async loadHistory(): Promise<void> {
		if (!this.sessionId || !this.o.storageEnabled) return;
		try {
			const storage = createStorage({ enabled: true });
			const session = await storage.getSession(this.sessionId);
			if (!session) return;
			const msgs = await storage.getMessages(this.sessionId);
			if (msgs.length === 0) return;
			this.renderHistory(msgs);
		} catch { /* non-fatal */ }
	}

	private renderHistory(msgs: MessageRecord[]): void {
		const renderedTools = new Map<string, ToolExecutionComponent>();
		for (const msg of msgs) {
			switch (msg.role) {
				case 'user':
					if (msg.content.trim()) this.chat.addChild(new UserMessageComponent(msg.content, this.mkTheme));
					break;
				case 'assistant': {
					const am = new AssistantMessageComponent(this.mkTheme);
					am.update(msg.content, msg.reasoning_content || '');
					this.chat.addChild(am);
					if (msg.tool_calls) {
						for (const tc of msg.tool_calls) {
							const c = new ToolExecutionComponent(tc.function.name, tc.id, safeJson(tc.function.arguments), this.mkTheme);
							renderedTools.set(tc.id, c);
							this.chat.addChild(c);
						}
					}
					break;
				}
				case 'tool': {
					const c = renderedTools.get(msg.tool_call_id || '');
					if (c) { c.finish(!msg.content.toLowerCase().startsWith('error'), msg.content); renderedTools.delete(msg.tool_call_id!); }
					break;
				}
			}
		}
		for (const [, c] of renderedTools) c.finish(false, '工具结果未收到');
	}

	private submit(v: string): void {
		const t = v.trim();
		if (!t) return;
		this.editor.setText('');
		if (t === '/exit' || t === '/quit') { this.ui.stop(); process.exit(0); }
		if (this.sending) return;
		this.sending = true;
		this.send(t).finally(() => { this.sending = false; });
	}

	private async send(msg: string): Promise<void> {
		this.abortController = new AbortController();
		this.pendingTools.clear();
		const onSigint = () => {
			if (this.confirmResolver) {
				this.confirmResolver(false);
				this.confirmResolver = null;
				this.confirmBar.clear();
				this.ui.setFocus(this.editor);
				return;
			}
			this.abortController?.abort();
		};
		process.on('SIGINT', onSigint);

		this.chat.addChild(new UserMessageComponent(msg, this.mkTheme));
		this.startWorking();

		try {
			const r = await this.runner.run({
				workspace: this.o.workspace, message: msg,
				sessionId: this.sessionId, newSession: this.o.newSession,
				modelId: this.o.modelId,
				storageEnabled: this.o.storageEnabled,
				signal: this.abortController.signal,
				onConfirm: async () => {
				return new Promise<boolean>((resolve) => {
					this.confirmResolver = resolve;
				});
			},
				onEvent: (e) => { this.handleEvent(e); },
			});
			this.sessionId = r.sessionId;
			this.endStream();
		} catch (err) {
			const e = err as Error & { name?: string };
			if (!this.abortController?.signal.aborted) {
				this.endStream();
				this.clearStatus();
				const am = new AssistantMessageComponent(this.mkTheme);
				am.showError(e.message);
				this.chat.addChild(am);
			}
		} finally {
			process.removeListener('SIGINT', onSigint);
			this.abortController = null;
			this.pendingTools.clear();
			this.clearStatus();
			this.updateFooter();
			this.ui.requestRender();
		}
	}

	private handleEvent(e: AgentEvent): void {
		switch (e.type) {
			case 'content':
			case 'reasoning':
				if (!this.streaming) this.beginStream();
				if (e.type === 'content') this.streamText += e.text;
				else this.streamReasoning += e.text;
				this.streaming!.update(this.streamText, this.streamReasoning);
				this.ui.requestRender();
				break;

			case 'tool_call':
				this.endStream();
				this.addToolComponent(e.name, e.args);
				this.ui.requestRender();
				break;

			case 'tool_execution_update': {
				const tc = this.findPendingTool(e.name);
				if (tc) {
					tc.markExecutionStarted();
					tc.appendOutput(e.text);
				}
				this.ui.requestRender();
				break;
			}

			case 'tool_result': {
				const tc = this.findPendingTool(e.name);
				if (tc) { tc.finish(e.success, e.output); this.pendingTools.delete(this.toolKeyFor(e.name)); }
				this.ui.requestRender();
				break;
			}

			case 'done':
				this.endStream();
				if (e.usage) { this.totalInput += e.usage.prompt_tokens; this.totalOutput += e.usage.completion_tokens; }
				if (e.contextWindow) this.contextWindow = e.contextWindow;
				this.updateFooter();
				this.ui.requestRender();
				break;

			case 'forked':
				this.sessionId = e.newSessionId;
				this.ui.requestRender();
				break;

			case 'retrying':
				this.endStream();
				this.clearStatus();
				this.currentStatus = new StatusIndicator('retry', this.ui, `重试中 (${e.attempt}/${e.maxRetries})...`);
				this.statusContainer.addChild(this.currentStatus);
				this.ui.requestRender();
				break;

			case 'retry_exhausted':
				this.clearStatus();
				this.chat.addChild(newTextError(this.mkTheme, e.message));
				this.ui.requestRender();
				break;

			case 'error':
				this.endStream();
				this.clearStatus();
				this.chat.addChild(newTextError(this.mkTheme, e.message));
				this.ui.requestRender();
				break;

			case 'confirm_required': {
			const confirm = new ConfirmInline(e.confirmation);
			confirm.onResponse = (approved) => {
				this.confirmBar.clear();
				this.ui.setFocus(this.editor);
				this.confirmResolver?.(approved);
				this.confirmResolver = null;
			};
			this.confirmBar.clear();
			this.confirmBar.addChild(confirm);
			this.ui.setFocus(confirm);
			break;
		}
			case 'steering_consumed': break;
		}
	}

	private startWorking(): void {
		this.clearStatus();
		this.currentStatus = new StatusIndicator('working', this.ui, 'AI 正在思考...');
		this.statusContainer.addChild(this.currentStatus);
		this.ui.requestRender(true);
	}

	private clearStatus(): void {
		this.currentStatus?.dispose();
		this.currentStatus = null;
		this.statusContainer.clear();
	}

	private beginStream(): void {
		this.statusContainer.clear();
		this.streaming = new AssistantMessageComponent(this.mkTheme);
		this.chat.addChild(this.streaming);
		this.streamText = '';
		this.streamReasoning = '';
	}

	private endStream(): void {
		if (this.streaming) {
			const hasTools = this.pendingTools.size > 0;
			this.streaming.update(this.streamText, this.streamReasoning, {
				hasToolCalls: hasTools,
			});
		}
		this.streaming = null;
	}

	private addToolComponent(name: string, args: Record<string, unknown>): void {
		const callId = `${name}_${Date.now()}_${this.pendingTools.size}`;
		const tc = new ToolExecutionComponent(name, callId, args, this.mkTheme);
		this.chat.addChild(tc);
		this.pendingTools.set(this.toolKeyFor(name), tc);
	}

	private findPendingTool(name: string): ToolExecutionComponent | undefined {
		return this.pendingTools.get(this.toolKeyFor(name));
	}

	private toolKeyFor(name: string): string { return name; }

	private updateFooter(): void {
		this.footer.setData({
			modelId: this.modelId,
			providerName: this.providerName || undefined,
			totalInput: this.totalInput || undefined,
			totalOutput: this.totalOutput || undefined,
		});
	}
}

function newTextError(mkTheme: ReturnType<typeof getMarkdownTheme>, msg: string): AssistantMessageComponent {
	const am = new AssistantMessageComponent(mkTheme);
	am.showError(msg);
	return am;
}

function safeJson(s: string): Record<string, unknown> { try { return JSON.parse(s); } catch { return {}; } }
