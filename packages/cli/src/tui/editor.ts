import { Terminal, moveCursor, clearLine, reset } from './terminal.js';
import { strWidth, charWidth } from './renderer.js';

function utf8Len(firstByte: number): number {
	if (firstByte < 0x80) return 1;
	if (firstByte < 0xC0) return 0;
	if (firstByte < 0xE0) return 2;
	if (firstByte < 0xF0) return 3;
	if (firstByte < 0xF8) return 4;
	return 0;
}

export class Editor {
	private text = '';
	private term: Terminal | null = null;
	private onMessage: ((text: string) => void) | null = null;
	private active = false;
	private promptRow = 0;
	private utf8Buf: Buffer[] = [];
	private utf8Remaining = 0;
	private history: string[] = [];
	private historyIndex = -1;
	private cursorPos = 0;
	private viewLineStart = 0;

	private onKey = (buf: Buffer): boolean => {
		if (!this.active) return false;

		if (buf.length > 1 && buf[0] === 0x1B) {
			if (buf.length >= 3 && buf[1] === 0x5B) {
				const code = buf[2];
				if (buf.length === 3) {
					if (code === 0x41) { this.historyUp(); return true; }
					if (code === 0x42) { this.historyDown(); return true; }
					if (code === 0x43) { this.cursorRight(); return true; }
					if (code === 0x44) { this.cursorLeft(); return true; }
					if (code === 0x48) { this.cursorHome(); return true; }
					if (code === 0x46) { this.cursorEnd(); return true; }
				}
				if (buf.length === 4 && code === 0x31 && buf[3] === 0x7E) {
					this.cursorHome(); return true;
				}
				if (buf.length === 4 && code === 0x34 && buf[3] === 0x7E) {
					this.cursorEnd(); return true;
				}
			}
			return true;
		}

		const byte = buf[0];

		if (this.utf8Remaining > 0) {
			this.utf8Buf.push(buf);
			this.utf8Remaining--;
			if (this.utf8Remaining === 0) {
				this.insertText(this.decodeUtf8());
			}
			return true;
		}

		if (byte >= 0x80) {
			const len = utf8Len(byte);
			if (len === 0) return false;
			if (len === 1) {
				this.insertText(buf.toString('utf8'));
				return true;
			}
			this.utf8Buf = [buf];
			this.utf8Remaining = len - 1;
			return true;
		}

		if (byte === 0x0D) {
			this.submit();
			return true;
		}

		if (byte === 0x03) {
			if (this.text.length === 0) {
				return false;
			} else {
				this.clearLine();
			}
			return true;
		}

		if (byte === 0x15) {
			this.clearLine();
			return true;
		}

		if (byte === 0x7F) {
			this.deleteBefore();
			return true;
		}

		if (byte >= 0x20 && byte < 0x7F) {
			this.insertText(buf.toString());
			return true;
		}

		return false;
	};

	private decodeUtf8(): string {
		const all = Buffer.concat(this.utf8Buf);
		const ch = all.toString('utf8');
		this.utf8Buf = [];
		return ch;
	}

	private insertText(ch: string): void {
		const before = this.text.slice(0, this.cursorPos);
		const after = this.text.slice(this.cursorPos);
		this.text = before + ch + after;
		this.cursorPos += ch.length;
		this.redraw();
	}

	private deleteBefore(): void {
		if (this.cursorPos === 0) return;
		const before = this.text.slice(0, this.cursorPos);
		this.text = before.slice(0, -1) + this.text.slice(this.cursorPos);
		this.cursorPos--;
		this.redraw();
	}

	private cursorLeft(): void {
		if (this.cursorPos > 0) {
			this.cursorPos--;
			this.redraw();
		}
	}

	private cursorRight(): void {
		if (this.cursorPos < this.text.length) {
			this.cursorPos++;
			this.redraw();
		}
	}

	private cursorHome(): void {
		this.cursorPos = 0;
		this.redraw();
	}

	private cursorEnd(): void {
		this.cursorPos = this.text.length;
		this.redraw();
	}

	private clearLine(): void {
		this.text = '';
		this.cursorPos = 0;
		this.viewLineStart = 0;
		this.redraw();
	}

	private submit(): void {
		const now = Date.now();
		if (this._lastSubmit && now - this._lastSubmit < 50) return;
		this._lastSubmit = now;

		const text = this.text;
		this.clearLine();
		if (text.trim()) {
			this.history.push(text);
		}
		this.historyIndex = -1;
		this.fireMessage(text);
	}
	private _lastSubmit = 0;

	private fireMessage(text: string): void {
		if (this.onMessage) {
			this.onMessage(text);
		}
	}

	private historyUp(): void {
		if (this.history.length === 0) return;
		if (this.historyIndex === -1) {
			this.historyIndex = this.history.length - 1;
		} else if (this.historyIndex > 0) {
			this.historyIndex--;
		}
		this.text = this.history[this.historyIndex];
		this.cursorPos = this.text.length;
		this.viewLineStart = 0;
		this.redraw();
	}

	private historyDown(): void {
		if (this.historyIndex === -1) return;
		if (this.historyIndex < this.history.length - 1) {
			this.historyIndex++;
			this.text = this.history[this.historyIndex];
		} else {
			this.historyIndex = -1;
			this.text = '';
		}
		this.cursorPos = this.text.length;
		this.viewLineStart = 0;
		this.redraw();
	}

	start(term: Terminal, handler: (text: string) => void): void {
		if (this.active) return;
		this.term = term;
		this.onMessage = handler;
		this.clearLine();
		this.active = true;
		term.addRawListener(this.onKey);

		this.promptRow = term.height;
		term.write(moveCursor(this.promptRow, 1));
		term.write(clearLine());
		term.write('> ');
	}

	stop(): void {
		this.active = false;
		if (this.term) {
			this.term.removeRawListener(this.onKey);
		}
		this.onMessage = null;
	}

	private redraw(): void {
		const term = this.term;
		if (!term) return;
		const width = term.width;
		const promptLen = 2;

		term.write(moveCursor(this.promptRow, 1));
		term.write(clearLine());
		term.write('> ');

		const displayText = this.text;
		const cursorOffset = strWidth(displayText.slice(0, this.cursorPos));

		if (displayText.length === 0) {
			term.write(moveCursor(this.promptRow, promptLen + 1));
			return;
		}

		const textWidth = strWidth(displayText);
		const maxTextWidth = width - promptLen;

		if (textWidth <= maxTextWidth) {
			term.write(displayText);
			term.write(moveCursor(this.promptRow, promptLen + cursorOffset + 1));
			return;
		}

		let visibleStart = this.viewLineStart;
		if (cursorOffset < visibleStart) {
			visibleStart = cursorOffset;
		} else if (cursorOffset > visibleStart + maxTextWidth - 1) {
			visibleStart = cursorOffset - maxTextWidth + 1;
		}

		this.viewLineStart = visibleStart;

		let visible = '';
		let w = 0;
		for (let i = 0; i < displayText.length; i++) {
			const cw = charWidth(displayText.codePointAt(i) || displayText.charCodeAt(i));
			if (w + cw > visibleStart) {
				if (w >= visibleStart) {
					visible += displayText[i];
				}
				if (w + cw > visibleStart + maxTextWidth) break;
			}
			w += cw;
		}

		term.write(visible);
		const cursorCol = promptLen + (cursorOffset - visibleStart) + 1;
		term.write(moveCursor(this.promptRow, cursorCol));
	}
}
