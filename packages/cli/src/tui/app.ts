import process from 'node:process';

import { getActiveModel, readConfig, getAllAvailableModels, setActiveModel, addProvider } from '@gatanot/qualia_core/config';
import type { AgentEvent, ConfirmFn } from '@gatanot/qualia_core/agent';

import { AgentRunner } from '../runtime/agent-runner.js';
import { Terminal } from './terminal.js';
import { ChatView } from './view.js';
import { ConfirmHandler } from './confirm.js';
import { Editor } from './editor.js';
import { parseSgrButton, splitByWhitespace } from './dfa.js';

function makeMouseHandler(view: ChatView): (buf: Buffer) => boolean {
	return (buf) => {
		if (buf.length < 3 || buf[0] !== 0x1B || buf[1] !== 0x5B) return false;

		if (buf[2] === 0x4D && buf.length >= 6) {
			const button = buf[3];
			if (button === 0x40) { view.scrollUp(3); view.render(); return true; }
			if (button === 0x41) { view.scrollDown(3); view.render(); return true; }
			return true;
		}

		if (buf[2] === 0x3C) {
			const btn = parseSgrButton(buf);
			if (btn === 64) { view.scrollUp(3); view.render(); return true; }
			if (btn === 65) { view.scrollDown(3); view.render(); return true; }
			return true;
		}

		return false;
	};
}

function makeScrollKeyHandler(view: ChatView): (buf: Buffer) => boolean {
	return (buf) => {
		if (buf.length >= 4 && buf[0] === 0x1B && buf[1] === 0x5B) {
			if (buf[2] === 0x35 && buf[3] === 0x7E) { view.pageUp(); view.render(); return true; }
			if (buf[2] === 0x36 && buf[3] === 0x7E) { view.pageDown(); view.render(); return true; }
		}
		return false;
	};
}

enum InterruptState { Idle, Interrupted }

export class TUIApp {
	private term: Terminal;
	private view: ChatView;
	private confirm: ConfirmHandler;
	private editor: Editor;
	private runner!: AgentRunner;
	private sessionId?: string;
	private workspace: string;
	private abortController: AbortController | null = null;
	private messageQueue: string[] = [];
	private resolveNext: ((msg: string) => void) | null = null;
	private running = false;

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
			console.log(validation.error || 'config invalid');
			process.exit(3);
		}

		this.term.enterRawMode();
		try {
			this.term.addRawListener(makeScrollKeyHandler(this.view));
			this.term.addRawListener(makeMouseHandler(this.view));
			this.term.onResize((_w, _h) => { this.view.renderFull(); });

			if (config.storageEnabled) {
				this.sessionId = await this.runner.createSession(this.workspace);
			}

			this.editor.start(this.term, (msg) => {
				this.enqueue(msg);
			});

			await this.chatLoop();
		} finally {
			this.editor.stop();
			this.term.dispose();
		}
	}

	private enqueue(msg: string): void {
		this.messageQueue.push(msg);
		if (this.resolveNext) {
			const r = this.resolveNext;
			this.resolveNext = null;
			r(this.messageQueue.shift()!);
		}
	}

	private dequeue(): Promise<string> {
		return new Promise<string>((resolve) => {
			if (this.messageQueue.length > 0) {
				resolve(this.messageQueue.shift()!);
			} else {
				this.resolveNext = resolve;
			}
		});
	}

	private async chatLoop(): Promise<void> {
		while (true) {
			this.view.renderFull();

			const message = await this.dequeue();
			while (this.messageQueue[0] === message) this.messageQueue.shift();
			const trimmed = message.trim();
			if (trimmed === '/exit' || trimmed === '/quit') break;
			if (!trimmed) continue;

			if (trimmed.startsWith('/')) {
				await this.handleSlashCommand(trimmed);
				continue;
			}

			this.view.addMessage('user', trimmed);
			this.view.renderFull();

			this.abortController = new AbortController();
			let interruptState = InterruptState.Idle;

			const streamKeyHandler = (buf: Buffer): boolean => {
				if (buf[0] === 0x1B && buf.length === 1) {
					if (interruptState === InterruptState.Idle) {
						interruptState = InterruptState.Interrupted;
						this.doInterrupt();
					}
					return true;
				}
				if (buf[0] === 0x03) {
					if (interruptState === InterruptState.Idle) {
						interruptState = InterruptState.Interrupted;
						this.doInterrupt();
					} else {
						this.term.dispose();
						process.exit(0);
					}
					return true;
				}
				return false;
			};

			this.term.addRawListener(streamKeyHandler);
			this.running = true;

			try {
				this.view.beginAssistant();

				const onConfirm: ConfirmFn = async (conf, _confirmId) => {
					const approved = await this.confirm.prompt(
						conf.toolName || '?',
						conf.reason || 'confirm?',
						conf.args,
					);
					this.view.renderFull();
					return approved;
				};

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
					this.view.addMessage('assistant', `continued: ${result.forkedSessionId}`);
					this.view.renderFull();
				}
			} catch (e: unknown) {
				const err = e as Error & { name?: string };
				if (err.name === 'AbortError') {
					// interrupted — already in transcript
				} else {
					this.view.addMessage('assistant', `error: ${err.message}`);
				}
				this.view.renderFull();
			} finally {
				this.running = false;
				this.term.removeRawListener(streamKeyHandler);
				this.abortController = null;
			}
		}
	}

	private async handleSlashCommand(cmd: string): Promise<void> {
		const parts = splitByWhitespace(cmd);
		const name = parts[0];
		const arg = parts.slice(1).join(' ');

		if (name === '/model' || name === '/models') {
			const models = getAllAvailableModels();
			if (models.length === 0) {
				this.view.addMessage('system', 'no models');
				this.view.renderFull();
				return;
			}
			const lines: string[] = ['models:'];
			const config = readConfig();
			for (let i = 0; i < models.length; i++) {
				const m = models[i];
				const active = m.model.id === config.activeModel ? ' *' : '';
				lines.push(`  ${i + 1}. ${m.model.id}${active}  (${m.providerName})`);
			}
			this.view.addMessage('system', lines.join('\n'));
			this.view.renderFull();

			return;
		}

		if (name === '/session' || name === '/sessions') {
			if (!this.runner.storageEnabled) {
				this.view.addMessage('system', 'storage disabled');
				this.view.renderFull();
				return;
			}
			const sessions = await this.runner.listSessions();
			if (sessions.length === 0) {
				this.view.addMessage('system', 'no sessions');
				this.view.renderFull();
				return;
			}
			const lines: string[] = ['sessions:'];
			for (let i = 0; i < sessions.length; i++) {
				const s = sessions[i];
				const active = s.id === this.sessionId ? ' *' : '';
				const title = s.title || '(untitled)';
				lines.push(`  ${i + 1}. ${title}${active}`);
			}
			this.view.addMessage('system', lines.join('\n'));
			this.view.renderFull();
			return;
		}

		if (name === '/help') {
			this.view.addMessage('system', [
				'/model     list models',
				'/session   list sessions',
				'/new       new session',
				'/exit      quit',
				'/help      this',
			].join('\n'));
			this.view.renderFull();
			return;
		}

		this.view.addMessage('system', `? ${name}. /help`);
		this.view.renderFull();
	}

	private doInterrupt(): void {
		this.confirm.cancel();
		this.abortController?.abort();
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
				break;
			case 'retry_exhausted':
			case 'steering_consumed':
				break;
			case 'error':
				this.view.addMessage('assistant', `error: ${event.message}`);
				this.view.renderFull();
				break;
		}
	}
}
