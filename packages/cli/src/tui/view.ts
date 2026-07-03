import { Terminal, moveCursor, clearLine, reset, dim, bold, fg } from './terminal.js';
import { renderMarkdown, renderReasoning, renderToolCall, renderToolResult, truncateToWidth, charWidth } from './renderer.js';
import { P } from './palette.js';
import { stripAnsi } from './dfa.js';

const BOTTOM_ROWS = 2;

interface MessageBlock {
	role: 'user' | 'assistant' | 'tool' | 'system';
	lines: string[];
	raw?: string;
	isStreaming?: boolean;
	isReasoning?: boolean;
	isToolOutput?: boolean;
	toolName?: string;
}

export class ChatView {
	private messages: MessageBlock[] = [];
	private term: Terminal;
	private prevLines: string[] = [];
	private prevWidth = 0;
	private contentWidth = 0;
	private needsFull = true;
	scrollOffset = 0;
	private autoScroll = true;

	constructor(term: Terminal) {
		this.term = term;
		this.prevWidth = term.width;
		this.contentWidth = term.width;
	}

	addMessage(role: 'user' | 'assistant' | 'system', content: string): void {
		if (role === 'system') {
			const lines = content.split('\n').map((l) => dim() + l + reset());
			this.messages.push({ role, lines, raw: content });
		} else {
			const lines = renderMarkdown(content, this.term.width);
			this.messages.push({ role, lines, raw: content });
		}
	}

	beginAssistant(): void {
		this.messages.push({ role: 'assistant', lines: [], isStreaming: true });
	}

	appendStreaming(text: string): void {
		const last = this.messages[this.messages.length - 1];
		if (!last || !last.isStreaming) {
			this.messages.push({ role: 'assistant', lines: [], isStreaming: true });
			this.appendRawText(this.messages[this.messages.length - 1], text);
			return;
		}
		this.appendRawText(last, text);
	}

	finishStreaming(): void {
		const block = this.messages[this.messages.length - 1];
		if (block && block.isStreaming) block.isStreaming = false;
	}

	addReasoning(text: string): void {
		const last = this.messages[this.messages.length - 1];
		if (last && last.isReasoning) {
			const parts = text.split('\n');
			const lastLine = last.lines[last.lines.length - 1];
			const stripped = lastLine.endsWith(reset()) ? lastLine.slice(0, -reset().length) : lastLine;
			last.lines[last.lines.length - 1] = stripped + parts[0] + reset();
			for (let i = 1; i < parts.length; i++) {
				last.lines.push(dim() + fg(P('reasoning')) + '  ' + parts[i] + reset());
			}
		} else {
			const lines = renderReasoning(text, this.term.width);
			this.messages.push({ role: 'assistant', lines, isReasoning: true, raw: text });
		}
	}

	addToolCall(name: string, args: Record<string, unknown>): void {
		const lines = renderToolCall(name, args, this.term.width);
		this.messages.push({
			role: 'tool', lines, isToolOutput: true, isStreaming: true, toolName: name,
		});
	}

	appendToolOutput(text: string): void {
		const sanitized = stripAnsi(text);
		const block = this.messages[this.messages.length - 1];

		if (!block || !block.isToolOutput || !block.isStreaming) {
			this.messages.push({ role: 'tool', lines: [dim() + sanitized + reset()], isToolOutput: true, isStreaming: true });
			return;
		}

		const maxLines = 16;
		const parts = sanitized.split('\n');
		for (const part of parts) {
			if (block.lines.length >= maxLines) {
				if (block.lines.length === maxLines) block.lines.push(dim() + '...' + reset());
				continue;
			}
			const wrapped = this.wrapLine(part, Math.max(this.term.width, 20));
			for (const w of wrapped) {
				if (block.lines.length >= maxLines) break;
				block.lines.push(dim() + w + reset());
			}
		}
	}

	addToolResult(name: string, success: boolean, output: string): void {
		const color = success ? P('success') : P('error');
		const status = success ? 'OK' : 'FAIL';
		const statusLine = bold() + fg(color) + status + reset() + ' ' + name;

		const block = this.messages[this.messages.length - 1];
		if (block && block.isToolOutput && block.toolName === name) {
			block.isStreaming = false;
			block.lines.push(statusLine);
		} else {
			const lines = renderToolResult(name, success, output, this.term.width);
			this.messages.push({ role: 'tool', lines });
		}
	}

	scrollUp(n: number): void { this.autoScroll = false; this.scrollOffset = Math.max(0, this.scrollOffset - n); }
	scrollDown(n: number): void {
		const all = this.getAllLines();
		const mv = Math.max(1, this.term.height - BOTTOM_ROWS);
		const maxOff = Math.max(0, all.length - mv);
		this.scrollOffset = Math.min(maxOff, this.scrollOffset + n);
		if (this.scrollOffset >= maxOff) { this.autoScroll = true; this.scrollOffset = maxOff; }
	}
	pageUp(): void { this.scrollUp(Math.max(1, this.term.height - BOTTOM_ROWS - 2)); }
	pageDown(): void { this.scrollDown(Math.max(1, this.term.height - BOTTOM_ROWS - 2)); }

	render(): void {
		const termW = this.term.width;
		if (termW !== this.prevWidth) { this.prevWidth = termW; this.needsFull = true; }

		const visible = this.getVisibleLines();
		const contentRows = this.term.height - BOTTOM_ROWS;

		this.term.write('\x1b[?2026h');

		if (this.needsFull) { this.fullRedraw(visible, contentRows); }
		else { this.diffRedraw(visible, contentRows); }

		const statusRow = this.term.height - 1;
		this.term.write(moveCursor(statusRow, 1));
		this.term.write(clearLine());
		this.term.write(dim() + fg(P('borderDim')) + '\u2500'.repeat(termW) + reset());

		this.term.write('\x1b[?2026l');
		this.prevLines = visible;
	}

	renderFull(): void { this.needsFull = true; this.render(); }

	private appendRawText(block: MessageBlock, text: string): void {
		if (!text) return;
		const parts = text.split('\n');
		for (const part of parts) {
			if (block.lines.length === 0) {
				block.lines.push(part);
			} else {
				const lastIdx = block.lines.length - 1;
				block.lines[lastIdx] = block.lines[lastIdx] + part;
			}
		}
	}

	private wrapLine(text: string, width: number): string[] {
		if (!text) return [''];
		const result: string[] = [];
		let remaining = text;
		while (remaining.length > 0) {
			let cut = 0, w = 0;
			for (let i = 0; i < remaining.length; i++) {
				const cw = charWidth(remaining.codePointAt(i) || remaining.charCodeAt(i));
				if (w + cw > width) break;
				w += cw; cut = i + 1;
			}
			if (cut === 0) cut = 1;
			result.push(remaining.slice(0, cut));
			remaining = remaining.slice(cut);
		}
		return result;
	}

	private rebuildNonToolLines(width: number): void {
		for (const msg of this.messages) {
			if (msg.isStreaming || msg.role === 'tool' || !msg.raw) continue;
			if (msg.isReasoning) {
				msg.lines = renderReasoning(msg.raw, width);
			} else {
				msg.lines = renderMarkdown(msg.raw, width);
			}
		}
	}

	private getAllLines(): string[] {
		const lines: string[] = [];
		for (const msg of this.messages) lines.push(...msg.lines);
		return lines;
	}

	private getVisibleLines(): string[] {
		const width = this.term.width;
		if (width !== this.contentWidth) {
			this.contentWidth = width;
			this.rebuildNonToolLines(width);
			this.needsFull = true;
			const all = this.getAllLines();
			const mv = Math.max(1, this.term.height - BOTTOM_ROWS);
			if (this.scrollOffset > Math.max(0, all.length - mv)) this.scrollOffset = Math.max(0, all.length - mv);
		}
		const all = this.getAllLines();
		const mv = Math.max(1, this.term.height - BOTTOM_ROWS);
		if (this.autoScroll) this.scrollOffset = Math.max(0, all.length - mv);
		const start = Math.max(0, Math.min(this.scrollOffset, Math.max(0, all.length - mv)));
		return all.slice(start, start + mv);
	}

	private fullRedraw(visible: string[], contentRows: number): void {
		this.term.write(moveCursor(1, 1));
		for (let i = 0; i < contentRows; i++) {
			this.term.write(clearLine());
			if (i < visible.length) this.term.write(truncateToWidth(visible[i], this.term.width));
			if (i < contentRows - 1) this.term.write('\r\n');
		}
		this.needsFull = false;
	}

	private diffRedraw(visible: string[], contentRows: number): void {
		const maxI = Math.max(visible.length, this.prevLines.length, contentRows);
		let lastWritten = -2;
		for (let i = 0; i < Math.min(maxI, contentRows); i++) {
			const cur = i < visible.length ? visible[i] : '';
			const prev = i < this.prevLines.length ? this.prevLines[i] : '';
			if (cur !== prev) {
				const row = i + 1;
				if (row !== lastWritten + 1) this.term.write(moveCursor(row, 1));
				this.term.write(clearLine());
				this.term.write(truncateToWidth(cur, this.term.width));
				lastWritten = row;
			}
		}
	}
}
