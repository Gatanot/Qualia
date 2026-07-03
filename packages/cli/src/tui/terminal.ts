import process from 'node:process';

const CSI = '\x1b[';

export function hideCursor(): string {
	return `${CSI}?25l`;
}

export function showCursor(): string {
	return `${CSI}?25h`;
}

export function moveCursor(row: number, col: number): string {
	return `${CSI}${row};${col}H`;
}

export function clearLine(mode: 0 | 1 | 2 = 2): string {
	return `${CSI}${mode}K`;
}

export function clearFromCursor(): string {
	return `${CSI}0J`;
}

export function clearScreen(): string {
	return `${CSI}2J`;
}

export function altScreen(): string {
	return `${CSI}?1049h`;
}

export function exitAltScreen(): string {
	return `${CSI}?1049l`;
}

export function reset(): string {
	return `${CSI}0m`;
}

export function syncStart(): string {
	return '\x1b[?2026h';
}

export function syncEnd(): string {
	return '\x1b[?2026l';
}

export function bold(): string {
	return `${CSI}1m`;
}

export function dim(): string {
	return `${CSI}2m`;
}

export function italic(): string {
	return `${CSI}3m`;
}

export function underline(): string {
	return `${CSI}4m`;
}

export function fg(code: number): string {
	return `${CSI}38;5;${code}m`;
}

export function bg(code: number): string {
	return `${CSI}48;5;${code}m`;
}

export function setColor(fgCode: number, bgCode?: number): string {
	if (bgCode !== undefined) {
		return `${fg(fgCode)}${bg(bgCode)}`;
	}
	return fg(fgCode);
}

export function saveCursor(): string {
	return '\x1b7';
}

export function restoreCursor(): string {
	return '\x1b8';
}

export class Terminal {
	width: number;
	height: number;
	private stdin: NodeJS.ReadStream;
	stdout: NodeJS.WriteStream;
	private rawMode = false;
	private resizeHandler?: () => void;
	private rawListeners: Array<(buf: Buffer) => boolean> = [];
	private escTimer: ReturnType<typeof setTimeout> | null = null;
	private escPending = false;
	private inEscapeSeq = false;

	constructor() {
		this.stdin = process.stdin;
		this.stdout = process.stdout;
		this.width = process.stdout.columns || 80;
		this.height = process.stdout.rows || 24;
		this.onRawData = this.onRawData.bind(this);
	}

	private onRawData(buf: Buffer): void {
		for (let i = 0; i < buf.length; i++) {
			const byte = buf[i];

			if (this.inEscapeSeq) {
				if (byte >= 0x40 && byte <= 0x7E) {
					this.inEscapeSeq = false;
				}
				continue;
			}

			if (this.escPending) {
				this.escPending = false;
				if (this.escTimer) {
					clearTimeout(this.escTimer);
					this.escTimer = null;
				}
				if (byte === 0x5B || byte === 0x4F) {
					this.inEscapeSeq = true;
				}
				continue;
			}

			if (byte === 0x1B) {
				if (i === buf.length - 1) {
					this.escPending = true;
					this.escTimer = setTimeout(() => {
						this.escPending = false;
						this.escTimer = null;
						this.dispatchRaw(Buffer.from([0x1B]));
					}, 15);
				} else {
					const next = buf[i + 1];
					if (next === 0x5B || next === 0x4F) {
						i++;
						this.inEscapeSeq = true;
					} else {
						this.dispatchRaw(Buffer.from([0x1B]));
					}
				}
				continue;
			}

			this.dispatchRaw(Buffer.from([byte]));
		}
	}

	private dispatchRaw(buf: Buffer): void {
		for (const listener of this.rawListeners) {
			if (listener(buf)) break;
		}
	}

	addRawListener(listener: (buf: Buffer) => boolean): void {
		this.rawListeners.push(listener);
	}

	removeRawListener(listener: (buf: Buffer) => boolean): void {
		const idx = this.rawListeners.indexOf(listener);
		if (idx >= 0) this.rawListeners.splice(idx, 1);
	}

	clearRawListeners(): void {
		this.rawListeners = [];
	}

	enterRawMode(): void {
		if (this.rawMode) return;
		if (this.stdin.isTTY) {
			this.stdin.setRawMode(true);
		}
		this.stdin.on('data', this.onRawData);
		this.rawMode = true;
		this.write(hideCursor());
	}

	exitRawMode(): void {
		if (!this.rawMode) return;
		if (this.escTimer) {
			clearTimeout(this.escTimer);
			this.escTimer = null;
		}
		this.escPending = false;
		this.inEscapeSeq = false;
		this.stdin.removeListener('data', this.onRawData);
		if (this.stdin.isTTY) {
			this.stdin.setRawMode(false);
		}
		this.rawMode = false;
		this.write(showCursor());
	}

	write(text: string): void {
		this.stdout.write(text);
	}

	onResize(callback: (width: number, height: number) => void): void {
		this.resizeHandler = () => {
			this.width = process.stdout.columns || 80;
			this.height = process.stdout.rows || 24;
			callback(this.width, this.height);
		};
		process.stdout.on('resize', this.resizeHandler);
	}

	offResize(): void {
		if (this.resizeHandler) {
			process.stdout.removeListener('resize', this.resizeHandler);
			this.resizeHandler = undefined;
		}
	}

	dispose(): void {
		this.exitRawMode();
		this.offResize();
		this.write(reset() + '\n');
	}
}
