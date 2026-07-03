import { Terminal, moveCursor, clearLine, reset, dim, bold } from './terminal.js';
import { renderMarkdown, renderReasoning, renderToolCall, renderToolResult, truncateToWidth } from './renderer.js';

interface MessageBlock {
	role: 'user' | 'assistant' | 'tool';
	lines: string[];
	isStreaming?: boolean;
	isReasoning?: boolean;
	isToolOutput?: boolean;
	toolName?: string;
}

export class ChatView {
	private messages: MessageBlock[] = [];
	private term: Terminal;
	private headerLines: string[] = [];
	private prevLines: string[] = [];
	private prevWidth = 0;
	private needsFull = true;
	statusText = '';
	scrollOffset = 0;
	private autoScroll = true;

	constructor(term: Terminal) {
		this.term = term;
		this.prevWidth = term.width;
	}

	addHeader(text: string): void {
		this.headerLines = renderMarkdown(text, this.term.width);
		this.needsFull = true;
	}

	addMessage(role: 'user' | 'assistant', content: string): void {
		const lines = this.renderContent(role, content);
		this.messages.push({ role, lines });
	}

	beginAssistant(): void {
		this.messages.push({ role: 'assistant', lines: [], isStreaming: true });
	}

	appendStreaming(text: string): void {
		const block = this.messages[this.messages.length - 1];
		if (!block || !block.isStreaming) {
			const newBlock: MessageBlock = { role: 'assistant', lines: [], isStreaming: true };
			this.messages.push(newBlock);
			this.appendToBlock(newBlock, text);
			return;
		}
		this.appendToBlock(block, text);
	}

	finishStreaming(): void {
		const block = this.messages[this.messages.length - 1];
		if (block) block.isStreaming = false;
	}

	addReasoning(text: string): void {
		const last = this.messages[this.messages.length - 1];
		if (last && last.isReasoning) {
			const indent = 4;
			const parts = text.split('\n');
			const lastLine = last.lines[last.lines.length - 1];
			const stripped = lastLine.endsWith(reset()) ? lastLine.slice(0, -reset().length) : lastLine;
			last.lines[last.lines.length - 1] = stripped + parts[0] + reset();
			for (let i = 1; i < parts.length; i++) {
				last.lines.push(dim() + ' '.repeat(indent) + parts[i] + reset());
			}
		} else {
			const lines = renderReasoning(text, this.term.width);
			this.messages.push({ role: 'assistant', lines, isReasoning: true });
		}
	}

	private appendToBlock(block: MessageBlock, text: string): void {
		if (!text) return;
		const lastLine = block.lines.length > 0 ? block.lines[block.lines.length - 1] : '';
		const parts = text.split('\n');
		if (parts.length === 1) {
			if (block.lines.length === 0) {
				block.lines.push(parts[0]);
			} else {
				block.lines[block.lines.length - 1] = lastLine + parts[0];
			}
		} else {
			if (block.lines.length === 0) {
				block.lines.push(parts[0]);
			} else {
				block.lines[block.lines.length - 1] = lastLine + parts[0];
			}
			for (let i = 1; i < parts.length; i++) {
				block.lines.push(parts[i]);
			}
		}
	}

	addToolCall(name: string, args: Record<string, unknown>): void {
		const header = renderToolCall(name, args, this.term.width);
		this.messages.push({ role: 'tool', lines: header, isToolOutput: true, isStreaming: true, toolName: name });
	}

	appendToolOutput(text: string): void {
		const sanitized = text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').replace(/\x07/g, '');
		const block = this.messages[this.messages.length - 1];
		if (block && block.isToolOutput && block.isStreaming) {
			const maxLines = 16;
			if (block.lines.length < maxLines) {
				this.appendToBlock(block, sanitized);
			} else if (block.lines.length === maxLines) {
				block.lines.push(dim() + '  ... (output truncated)' + reset());
			}
		} else {
			const newBlock: MessageBlock = { role: 'tool', lines: [], isToolOutput: true, isStreaming: true };
			this.messages.push(newBlock);
			this.appendToBlock(newBlock, sanitized);
		}
	}

	addToolResult(name: string, success: boolean, output: string): void {
		const block = this.messages[this.messages.length - 1];
		if (block && block.isToolOutput && block.toolName === name) {
			block.isStreaming = false;
			block.lines.push(`${success ? bold() + '[OK]' + reset() : bold() + '[FAIL]' + reset()} ${name}`);
		} else {
			const lines = renderToolResult(name, success, output, this.term.width);
			this.messages.push({ role: 'tool', lines });
		}
	}

	private renderContent(role: 'user' | 'assistant', content: string): string[] {
		return renderMarkdown(content, this.term.width);
	}

	getAllLines(): string[] {
		const lines: string[] = [];
		for (const h of this.headerLines) lines.push(h);
		if (this.headerLines.length > 0) lines.push('');
		for (const msg of this.messages) {
			lines.push(...msg.lines);
		}
		return lines;
	}

	private getVisibleLines(): string[] {
		const allLines = this.getAllLines();
		const maxVisible = this.term.height - 2;
		if (this.autoScroll) {
			this.scrollOffset = Math.max(0, allLines.length - maxVisible);
		}
		const startRow = Math.max(0, Math.min(this.scrollOffset, Math.max(0, allLines.length - maxVisible)));
		return allLines.slice(startRow, startRow + maxVisible);
	}

	scrollUp(lines: number): void {
		this.autoScroll = false;
		this.scrollOffset = Math.max(0, this.scrollOffset - lines);
	}

	scrollDown(lines: number): void {
		const allLines = this.getAllLines();
		const maxVisible = this.term.height - 2;
		const bottom = Math.max(0, allLines.length - maxVisible);
		this.scrollOffset = Math.min(bottom, this.scrollOffset + lines);
		if (this.scrollOffset >= bottom) {
			this.autoScroll = true;
			this.scrollOffset = bottom;
		}
	}

	render(): void {
		const width = this.term.width;
		if (width !== this.prevWidth) {
			this.prevWidth = width;
			this.needsFull = true;
		}

		const visible = this.getVisibleLines();

		if (this.needsFull) {
			this.fullRedraw(visible);
		} else {
			this.diffRedraw(visible);
		}

		const statusRow = this.term.height - 1;
		this.term.write(moveCursor(statusRow, 1));
		this.term.write(clearLine());
		if (this.statusText) {
			this.term.write(dim() + this.statusText.slice(0, this.term.width) + reset());
		}

		this.prevLines = visible;
	}

	private fullRedraw(visible: string[]): void {
		const termH = this.term.height;
		this.term.write(moveCursor(1, 1));
		for (let i = 0; i < termH - 1; i++) {
			this.term.write(clearLine());
			if (i < visible.length) {
				this.term.write(truncateToWidth(visible[i], this.term.width));
			}
			if (i < termH - 2) this.term.write('\r\n');
		}
		this.needsFull = false;
	}

	private diffRedraw(visible: string[]): void {
		const termH = this.term.height;
		const maxI = Math.max(visible.length, this.prevLines.length, termH - 1);
		let lastWritten = -2;

		for (let i = 0; i < Math.min(maxI, termH - 1); i++) {
			const cur = i < visible.length ? visible[i] : '';
			const prev = i < this.prevLines.length ? this.prevLines[i] : '';
			if (cur !== prev) {
				const row = i + 1;
				if (row !== lastWritten + 1) {
					this.term.write(moveCursor(row, 1));
				}
				this.term.write(clearLine());
				this.term.write(truncateToWidth(cur, this.term.width));
				lastWritten = row;
			}
		}
	}

	renderFull(): void {
		this.needsFull = true;
		this.render();
	}
}
