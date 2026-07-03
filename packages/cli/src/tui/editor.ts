import { Terminal, moveCursor, clearLine, reset } from './terminal.js';

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
	private onSubmit: ((text: string) => void) | null = null;
	private active = false;
	private promptRow = 0;
	private utf8Buf: Buffer[] = [];
	private utf8Remaining = 0;

	private onKey = (buf: Buffer): boolean => {
		if (!this.active) return false;

		const byte = buf[0];

		if (this.utf8Remaining > 0) {
			this.utf8Buf.push(buf);
			this.utf8Remaining--;
			if (this.utf8Remaining === 0) {
				this.appendUtf8();
			}
			return true;
		}

		if (byte >= 0x80) {
			const len = utf8Len(byte);
			if (len === 0) return false;
			if (len === 1) {
				const ch = buf.toString('utf8');
				this.text += ch;
				this.term?.write(ch);
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

		if (byte === 0x04) {
			if (this.text.length === 0) {
				this.text = '/exit';
				this.submit();
				return true;
			}
			return false;
		}

		if (byte === 0x03) {
			this.text = '';
			this.redraw();
			return true;
		}

		if (byte === 0x7F) {
			if (this.text.length > 0) {
				this.text = this.text.slice(0, -1);
				this.redraw();
			}
			return true;
		}

		if (byte >= 0x20 && byte < 0x7F) {
			this.text += buf.toString();
			this.redraw();
			return true;
		}

		return false;
	};

	private appendUtf8(): void {
		const all = Buffer.concat(this.utf8Buf);
		const ch = all.toString('utf8');
		this.text += ch;
		this.term?.write(ch);
		this.utf8Buf = [];
	}

	private submit(): void {
		const text = this.text;
		this.text = '';
		this.active = false;
		if (this.term && this.onSubmit) {
			this.term.write('\r\n');
			this.term.removeRawListener(this.onKey);
			const cb = this.onSubmit;
			this.onSubmit = null;
			cb(text);
		}
	}

	activate(term: Terminal, onSubmit: (text: string) => void): void {
		this.term = term;
		this.onSubmit = onSubmit;
		this.text = '';
		this.active = true;
		term.addRawListener(this.onKey);

		const row = term.height;
		this.promptRow = row;
		term.write(moveCursor(row, 1));
		term.write(clearLine());
		term.write('> ');
	}

	deactivate(): void {
		this.active = false;
		if (this.term) {
			this.term.removeRawListener(this.onKey);
		}
		this.onSubmit = null;
	}

	private redraw(): void {
		if (!this.term) return;
		this.term.write(moveCursor(this.promptRow, 1));
		this.term.write(clearLine());
		this.term.write('> ' + this.text);
	}

	waitForInput(term: Terminal): Promise<string> {
		return new Promise((resolve) => {
			this.activate(term, (text) => {
				resolve(text);
			});
		});
	}
}
