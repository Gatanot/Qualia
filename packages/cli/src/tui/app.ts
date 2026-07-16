import process from 'node:process';
import type { AgentEvent } from '@gatanot/qualia_core/agent';
import { createStorage, type MessageRecord } from '@gatanot/qualia_core/storage';
import { HttpAgentRunner } from '../runtime/http-runner.js';
import { loadRuntimeConfig } from '../runtime/config-loader.js';
import { type CliIO, VERSION } from '../commands/index.js';
import { CliError } from '../errors.js';

import { Container, Editor, type EditorTheme, SelectList, type SelectItem, type SelectListTheme, ProcessTerminal, TUI, Text } from './index.js';
import { getMarkdownTheme, theme } from './theme.js';
import { UserMessageComponent } from './user-message.js';
import { AssistantMessageComponent } from './assistant-message.js';
import { ToolExecutionComponent } from './tool-execution.js';
import { FooterComponent } from './footer.js';
import { StatusIndicator } from './status-indicator.js';
import { ConfirmInline } from './confirm-dialog.js';
import { createAutocompleteProvider, parseSlashCommand } from './slash-commands.js';
import { getAllAvailableModels, getProviderForModel, setActiveModel, addProvider } from '@gatanot/qualia_core/config';

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
	io: CliIO; workspace: string; baseURL: string;
	sessionId?: string; newSession?: boolean; modelId?: string;
}

export class TuiApp {
	private readonly runner: HttpAgentRunner;
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
	private providerName = '';
	private contextWindow = 0;
	private modelId = '';
	private confirmBar = new Container();
	private confirmResolver: ((approved: boolean) => void) | null = null;
	private chatSnapshot = -1;
	private lastSentText = '';

	constructor(private readonly o: TuiAppOptions) {
		this.sessionId = o.newSession ? undefined : o.sessionId;
		this.runner = new HttpAgentRunner(o.baseURL);
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
			const rt = loadRuntimeConfig({ modelId: this.o.modelId });
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

		this.editor.setAutocompleteProvider(createAutocompleteProvider(this.o.workspace));

		this.ui.start();
		this.updateFooter();

		await this.loadHistory();
		if (this.chat.children.length === 0) {
			this.showWelcome();
		}
		this.ui.requestRender();
	}

	private submit(v: string): void {
		const t = v.trim();
		if (!t) return;
		this.editor.setText('');
		if (t === '/exit' || t === '/quit') { this.ui.stop(); process.exit(0); }
		if (this.sending) return;

		const parsed = parseSlashCommand(t);
		if (parsed.type === 'command') {
			void this.executeSlashCommand(parsed.action, parsed.arg);
			return;
		}
		if (parsed.type === 'none') return;

		this.lastSentText = v;
		this.chatSnapshot = this.chat.children.length;
		this.sending = true;
		this.send(parsed.type === 'send' ? parsed.value : t).finally(() => { this.sending = false; });
	}

	private async executeSlashCommand(action: string, arg?: string): Promise<void> {
		switch (action) {
			case 'model':
				await this.cmdModel();
				break;
			case 'new':
				this.cmdNew();
				break;
			case 'session':
				await this.cmdSession();
				break;
			case 'provider':
				this.cmdProvider(arg);
				break;
			case 'undo':
				this.cmdUndo();
				break;
			case 'end':
				await this.cmdEnd();
				return;
		}
		this.ui.requestRender();
	}

	private async cmdModel(): Promise<void> {
		const models = getAllAvailableModels();
		if (models.length === 0) {
			this.chat.addChild(newTextError(this.mkTheme, 'No models available'));
			return;
		}
		const items: SelectItem[] = models.map((m) => ({
			value: m.model.id,
			label: m.model.id,
			description: m.model.id === this.modelId ? m.model.name + ' (active)' : m.model.name,
		}));
		const list = new SelectList(items, Math.min(10, items.length), selectListTheme, { bordered: true, title: 'Models' });
		list.onSelect = async (item) => {
			this.ui.hideOverlay();
			this.ui.setFocus(this.editor);
			try {
				setActiveModel(item.value);
				this.modelId = item.value;
				this.providerName = getProviderForModel(item.value)?.name || '';
				this.updateFooter();
			} catch (err) {
				this.chat.addChild(newTextError(this.mkTheme, `Switch failed: ${(err as Error).message}`));
			}
		};
		list.onCancel = () => {
			this.ui.hideOverlay();
			this.ui.setFocus(this.editor);
		};
		this.ui.showOverlay(list, { anchor: 'center', width: '60%', maxHeight: '50%', margin: 1 });
	}

	private cmdNew(): void {
		this.sessionId = undefined;
		this.chat.clear();
		this.chatSnapshot = -1;
		this.lastSentText = '';
		this.chat.addChild(newTextError(this.mkTheme, 'New conversation started'));
	}

	private async cmdSession(): Promise<void> {
		const storage = createStorage({ enabled: true });
		try {
			const sessions = await storage.listSessions();
			if (sessions.length === 0) {
				this.chat.addChild(newTextError(this.mkTheme, 'No sessions'));
				return;
			}
			const items: SelectItem[] = sessions.slice(0, 50).map((s) => ({
				value: s.id,
				label: s.title.length > 40 ? s.title.slice(0, 40) + '…' : s.title,
				description: s.id.slice(0, 8),
			}));
			const list = new SelectList(items, Math.min(10, items.length), selectListTheme, { bordered: true, title: 'Sessions' });
			list.onSelect = async (item) => {
				this.ui.hideOverlay();
				this.ui.setFocus(this.editor);
				await this.switchToSession(item.value);
			};
			list.onCancel = () => {
				this.ui.hideOverlay();
				this.ui.setFocus(this.editor);
			};
			this.ui.showOverlay(list, { anchor: 'center', width: '70%', maxHeight: '50%', margin: 1 });
		} catch {
			this.chat.addChild(newTextError(this.mkTheme, 'Unable to list sessions'));
		}
	}

	private async switchToSession(id: string): Promise<void> {
		const storage = createStorage({ enabled: true });
		try {
			const session = await storage.getSession(id);
			if (!session) {
				this.chat.addChild(newTextError(this.mkTheme, 'Session not found'));
				return;
			}
			this.sessionId = id;
			this.chat.clear();
			this.chatSnapshot = -1;
			this.lastSentText = '';
			await this.loadHistory();
			this.ui.requestRender();
		} catch {
			this.chat.addChild(newTextError(this.mkTheme, 'Session switch failed'));
		}
	}

	private cmdProvider(arg?: string): void {
		if (!arg) {
			this.chat.addChild(newTextError(this.mkTheme,
				'Usage: /provider <type> <API Key>\nTypes: openai, deepseek, xiaomi, ollama\nExample: /provider openai sk-xxx'));
			return;
		}
		const parts = arg.split(/\s+/);
		const type = parts[0] as 'openai' | 'deepseek' | 'xiaomi' | 'ollama';
		const apiKey = parts.slice(1).join(' ');
		if (!['openai', 'deepseek', 'xiaomi', 'ollama'].includes(type)) {
			this.chat.addChild(newTextError(this.mkTheme, `Unsupported provider type: ${type}`));
			return;
		}
		if (!apiKey) {
			this.chat.addChild(newTextError(this.mkTheme, 'API Key required'));
			return;
		}
		try {
			const name = `${type}-${Date.now().toString(36)}`;
			addProvider({
				type,
				name,
				apiKey,
				baseURL: '',
			});
			this.chat.addChild(newTextError(this.mkTheme, `Provider added: ${type} (${name})`));
		} catch (err) {
			this.chat.addChild(newTextError(this.mkTheme, `Add failed: ${(err as Error).message}`));
		}
	}

	private cmdUndo(): void {
		if (this.chatSnapshot < 0) return;
		while (this.chat.children.length > this.chatSnapshot) {
			this.chat.children.pop();
		}
		this.editor.setText(this.lastSentText);
		this.chatSnapshot = -1;
		this.lastSentText = '';
		this.ui.requestRender();
	}

	private async cmdEnd(): Promise<void> {
		try {
			await fetch(`${this.o.baseURL}/api/shutdown`, { method: 'POST' });
		} catch {
			// back end may already be gone
		}
		this.ui.stop();
		process.exit(0);
	}

	private showWelcome(): void {
		const logo = [
			'   ██████╗ ██╗   ██╗ █████╗ ██╗     ██╗ █████╗',
			'  ██╔═══██╗██║   ██║██╔══██╗██║     ██║██╔══██╗',
			'  ██║   ██║██║   ██║███████║██║     ██║███████║',
			'  ██║▄▄ ██║██║   ██║██╔══██║██║     ██║██╔══██║',
			'  ╚██████╔╝╚██████╔╝██║  ██║███████╗██║██║  ██║',
			'   ╚══▀▀═╝  ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝╚═╝  ╚═╝',
			'',
		];
		const info = [
			`  Qualia v${VERSION}  ·  local AI companion`,
			'',
			'  Type / to see available commands.',
			'',
		];
		const text = theme.fg('accent', logo.join('\n')) + theme.fg('muted', info.join('\n'));
		this.chat.addChild(new Text(text, 1, 0));
	}

	private async loadHistory(): Promise<void> {
		if (!this.sessionId) return;
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
		for (const [, c] of renderedTools) c.finish(false, 'Tool result not received');
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
				sessionId: this.sessionId,
				modelId: this.o.modelId,
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
				this.currentStatus = new StatusIndicator('retry', this.ui, `Retrying (${e.attempt}/${e.maxRetries})...`);
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
		this.currentStatus = new StatusIndicator('working', this.ui, 'AI is thinking...');
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
			totalInput: this.totalInput || undefined,
			totalOutput: this.totalOutput || undefined,
			contextWindow: this.contextWindow || undefined,
			cwd: this.o.workspace,
		});
	}
}

function newTextError(mkTheme: ReturnType<typeof getMarkdownTheme>, msg: string): AssistantMessageComponent {
	const am = new AssistantMessageComponent(mkTheme);
	am.showError(msg);
	return am;
}

function safeJson(s: string): Record<string, unknown> { try { return JSON.parse(s); } catch { return {}; } }
