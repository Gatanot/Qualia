import process from 'node:process';

import { getActiveModel, readConfig } from '@gatanot/qualia_core/config';
import type { AgentEvent, ConfirmFn } from '@gatanot/qualia_core/agent';

import { AgentRunner } from '../runtime/agent-runner.js';
import { Terminal } from './terminal.js';
import { ChatView } from './view.js';
import { ConfirmHandler } from './confirm.js';
import { Editor } from './editor.js';

function makeMouseHandler(view: ChatView): (buf: Buffer) => boolean {
	return (buf) => {
		// Mouse events: ESC [ M b x y  (3 extra bytes after M)
		if (buf.length >= 6 && buf[0] === 0x1B && buf[1] === 0x5B && buf[2] === 0x4D) {
			const button = buf[3];
			if (button === 0x40) { view.scrollUp(3); view.render(); return true; }
			if (button === 0x41) { view.scrollDown(3); view.render(); return true; }
			return true;
		}
		return false;
	};
}

export class TUIApp {
	private term: Terminal;
	private view: ChatView;
	private confirm: ConfirmHandler;
	private editor: Editor;
	private runner!: AgentRunner;
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
		this.runner = new AgentRunner();

		const validation = this.runner.validate();
		if (!validation.ok) {
			console.log(validation.error || '配置无效');
			process.exit(3);
		}

		const model = getActiveModel();

		this.term.enterRawMode();
		try {
			this.term.addRawListener(makeMouseHandler(this.view));
			this.term.write('\x1b[2J');
			this.view.addHeader(`Qualia · ${model?.name || config.activeModel} · ${this.workspace}`);

			this.term.onResize((_w, _h) => {
				this.view.renderFull();
			});

			this.view.renderFull();

			if (config.storageEnabled) {
				this.sessionId = await this.runner.createSession(this.workspace);
			}

			await this.chatLoop();
		} finally {
			this.term.dispose();
		}
	}

	private async chatLoop(): Promise<void> {
		while (true) {
			this.view.statusText = '';
			this.view.renderFull();

			const message = await this.editor.waitForInput(this.term);
			const trimmed = message.trim();
			if (trimmed === '/exit' || trimmed === '/quit') break;
			if (!trimmed) continue;

			this.view.addMessage('user', trimmed);
			this.view.renderFull();

			this.abortController = new AbortController();
			this.escCount = 0;
			this.view.statusText = 'ESC: interrupt  Ctrl+C: exit';
			this.view.render();
			this.view.beginAssistant();

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

			const onConfirm: ConfirmFn = async (conf, _confirmId) => {
				const msg = conf.reason || `执行 ${conf.toolName || '未知操作'}？`;
				const approved = await this.confirm.prompt(msg);
				this.view.renderFull();
				return approved;
			};

			try {
				const result = await this.runner.run({
					message: trimmed,
					sessionId: this.sessionId,
					workspace: this.workspace,
					signal: this.abortController.signal,
					onConfirm,
					onEvent: (event) => { this.handleEvent(event); },
				});

				this.sessionId = result.sessionId;
				if (result.forkedSessionId) {
					this.sessionId = result.forkedSessionId;
					this.view.addMessage('assistant', `对话已延续到新会话：${result.forkedSessionId}`);
					this.view.renderFull();
				}
			} catch (e) {
				this.view.addMessage('assistant', `错误：${(e as Error).message}`);
				this.view.renderFull();
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

	private handleEvent(event: AgentEvent): void {
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
			case 'forked':
				break;
			case 'retrying':
			case 'retry_exhausted':
			case 'steering_consumed':
				break;
			case 'error':
				this.view.addMessage('assistant', `错误：${event.message}`);
				this.view.renderFull();
				break;
		}
	}
}
