import { Terminal, moveCursor, clearLine, fg, dim, reset } from './terminal.js';
import { truncateToWidth } from './renderer.js';

export class ConfirmHandler {
	private term: Terminal;
	private active = false;
	private activeResolve: ((v: boolean) => void) | null = null;

	constructor(term: Terminal) {
		this.term = term;
		this.term.addRawListener(this.onRawKey.bind(this));
	}

	private onRawKey(buf: Buffer): boolean {
		if (!this.active) return false;

		if (buf[0] === 0x1B && buf.length === 1) {
			this.resolveAndClear(false);
			return true;
		}

		const key = buf.toString().toLowerCase().trim();
		if (key === 'y' || key === 'yes') {
			this.resolveAndClear(true);
			return true;
		}
		if (key === 'n' || key === 'no') {
			this.resolveAndClear(false);
			return true;
		}
		return false;
	}

	private resolveAndClear(result: boolean): void {
		this.active = false;
		this.term.write(moveCursor(this.term.height, 1));
		this.term.write(clearLine());
		if (this.activeResolve) {
			this.activeResolve(result);
			this.activeResolve = null;
		}
	}

	cancel(): void {
		if (this.active) {
			this.resolveAndClear(false);
		}
	}

	async prompt(
		toolName: string,
		reason: string,
		args?: Record<string, unknown>,
	): Promise<boolean> {
		const width = this.term.width;

		this.term.write(moveCursor(this.term.height, 1));
		this.term.write(clearLine());
		this.term.write(fg(15) + '\x1b[48;5;237m');

		const header = ` [${toolName}] ${reason || 'confirm?'}`;
		this.term.write(truncateToWidth(header, width));
		this.term.write(reset());

		let rowOffset = 0;
		if (args && Object.keys(args).length > 0) {
			rowOffset = 1;
			const argsY = this.term.height - rowOffset;
			this.term.write(moveCursor(argsY, 1));
			this.term.write(clearLine());
			const argsStr = JSON.stringify(args, null, 2);
			const firstLine = argsStr.split('\n')[0];
			const preview = truncateToWidth(dim() + '  ' + firstLine + reset(), width);
			this.term.write(preview);
		}

		const promptY = this.term.height;
		this.term.write(moveCursor(promptY, 1));
		this.term.write(clearLine());
		this.term.write(fg(15) + '\x1b[48;5;237m');
		this.term.write(truncateToWidth(' [y] approve  [n/Esc] deny', width));
		this.term.write(reset());

		this.active = true;

		return new Promise<boolean>((resolve) => {
			this.activeResolve = resolve;
		});
	}
}
