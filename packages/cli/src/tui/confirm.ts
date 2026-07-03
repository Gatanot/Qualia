import { Terminal, moveCursor, clearLine, fg, reset } from './terminal.js';

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

	async prompt(message: string): Promise<boolean> {
		const y = this.term.height;
		const width = this.term.width;

		const promptText = `  ${message}  [y/n] `;
		const trimmed = promptText.length > width ? promptText.slice(0, width - 3) + '...' : promptText;

		this.term.write(moveCursor(y, 1));
		this.term.write(clearLine());
		this.term.write(fg(15) + '\x1b[48;5;237m');
		this.term.write(trimmed);
		this.term.write(reset());

		this.active = true;

		return new Promise<boolean>((resolve) => {
			this.activeResolve = resolve;
		});
	}
}
