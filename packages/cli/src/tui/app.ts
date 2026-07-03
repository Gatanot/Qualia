import { AgentRunner } from '../runtime/agent-runner.js';
import type { CliIO } from '../commands/index.js';
import { CliError } from '../errors.js';
import { TerminalSession } from './terminal.js';
import { createTuiConfirm } from './confirm.js';
import { renderEvent, renderHeader, cyan, dim } from './renderer.js';

export interface TuiAppOptions {
	io: CliIO;
	workspace: string;
	sessionId?: string;
	modelId?: string;
	storageEnabled?: boolean;
}

export class TuiApp {
	private readonly term: TerminalSession;
	private readonly runner = new AgentRunner();
	private sessionId?: string;
	private abortController: AbortController | null = null;

	constructor(private readonly options: TuiAppOptions) {
		this.term = new TerminalSession(options.io);
		this.sessionId = options.sessionId;
	}

	async start(): Promise<void> {
		if (!this.options.io.stdin.isTTY || !this.options.io.stdout.isTTY) {
			throw new CliError('USAGE', '交互式 TUI 需要 TTY。非交互场景请使用 `qualia -p "..."`。');
		}

		const onSigint = () => {
			if (this.abortController) {
				this.abortController.abort();
				this.term.write('\n已请求取消当前回答。\n');
			} else {
				this.term.close();
				process.exit(0);
			}
		};
		process.on('SIGINT', onSigint);

		try {
			this.term.write(renderHeader({
				modelId: this.options.modelId,
				workspace: this.options.workspace,
				sessionId: this.sessionId
			}));

			while (true) {
				const input = (await this.term.question(cyan('你 > '))).trim();
				if (!input) continue;
				if (input === '/exit' || input === '/quit') break;
				if (input === '/help') {
					this.term.write('可用命令：/exit 退出，/session 显示当前会话。\n');
					continue;
				}
				if (input === '/session') {
					this.term.write(`${this.sessionId || '(new)'}\n`);
					continue;
				}

				await this.send(input);
			}
		} finally {
			process.removeListener('SIGINT', onSigint);
			this.term.close();
		}
	}

	private async send(message: string): Promise<void> {
		this.abortController = new AbortController();
		this.term.write(cyan('AI > '));

		try {
			const result = await this.runner.run({
				workspace: this.options.workspace,
				message,
				sessionId: this.sessionId,
				modelId: this.options.modelId,
				storageEnabled: this.options.storageEnabled,
				signal: this.abortController.signal,
				onConfirm: createTuiConfirm(this.term),
				onEvent: (event) => {
					const rendered = renderEvent(event);
					if (rendered) this.term.write(rendered);
				}
			});
			this.sessionId = result.sessionId;
			this.term.write(dim(`session: ${this.sessionId}`) + '\n');
		} catch (error) {
			if (this.abortController.signal.aborted) {
				this.term.write('\n已取消。\n');
				return;
			}
			throw error;
		} finally {
			this.abortController = null;
		}
	}
}
