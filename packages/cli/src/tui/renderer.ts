import { marked } from 'marked';
import type { Token } from 'marked';
import hljs from 'highlight.js';
import { reset, bold, dim, italic, underline, clearLine } from './terminal.js';

const COLORS = {
	code: 248,
	heading: 15,
	link: 39,
	blockquote: 245,
	list: 250,
	toolName: 75,
	toolArgs: 8,
	success: 42,
	error: 196,
};

function ansi(s: string, ...codes: string[]): string {
	if (!s) return s;
	return codes.join('') + s + reset();
}

function wrap(text: string, width: number): string[] {
	if (!text) return [''];
	const lines: string[] = [];
	for (const paragraph of text.split('\n')) {
		if (paragraph.length <= width) {
			lines.push(paragraph);
			continue;
		}
		let remaining = paragraph;
		while (remaining.length > width) {
			let cut = width;
			const spaceIdx = remaining.lastIndexOf(' ', width);
			if (spaceIdx > width / 2) cut = spaceIdx;
			lines.push(remaining.slice(0, cut));
			remaining = remaining.slice(cut).trimStart();
		}
		if (remaining) lines.push(remaining);
	}
	return lines;
}

function renderToken(token: Token, width: number): string[] {
	switch (token.type) {
		case 'heading': {
			const prefix = '#'.repeat(token.depth);
			const text = `${prefix} ${token.text}`;
			return wrap(ansi(text, bold(), underline()), width);
		}
		case 'paragraph': {
			const tokens = 'tokens' in token ? token.tokens : [];
			if (!tokens || tokens.length === 0) {
				return wrap(ansi(token.text || '', reset()), width);
			}
			let line = '';
			const result: string[] = [];
			for (const t of tokens) {
				if (t.type === 'text') {
					const text = 'tokens' in t ? (t as unknown as { text: string }).text : (t as { text?: string; raw?: string }).text || (t as { raw: string }).raw || '';
					line += text;
				} else if (t.type === 'strong') {
					line += ansi((t as { text: string }).text || '', bold());
				} else if (t.type === 'em') {
					line += ansi((t as { text: string }).text || '', italic());
				} else if (t.type === 'codespan') {
					line += ansi((t as { text: string }).text || '', dim());
				} else if (t.type === 'link') {
					const link = t as { text: string; href: string };
					line += ansi(link.text || link.href, dim(), underline());
				} else if (t.type === 'del') {
					line += dim() + ((t as { text: string }).text || '');
				} else {
					line += (t as { raw?: string; text?: string }).raw || (t as { text: string }).text || '';
				}
			}
			for (const l of wrap(line, width)) {
				result.push(l);
			}
			return result;
		}
		case 'code': {
			const text = token.text || '';
			let highlighted = '';
			try {
				if (token.lang && hljs.getLanguage(token.lang)) {
					highlighted = hljs.highlight(text, { language: token.lang }).value;
				}
			} catch {
				highlighted = text;
			}
			const display = highlighted || text;
			const lines = display.split('\n');
			return lines.map((l: string) => ansi(l, dim()));
		}
		case 'blockquote': {
			const text = 'tokens' in token ? (token as { text: string }).text : token.raw || '';
			const lines = wrap(text, Math.max(width - 2, 20));
			return lines.map((l) => ansi('│ ' + l, dim()));
		}
		case 'list': {
			const result: string[] = [];
			for (let i = 0; i < token.items.length; i++) {
				const item = token.items[i];
				const bullet = token.ordered ? `${token.start + i}.` : '•';
				const text = 'tokens' in item ? (item as { text: string }).text || item.raw || '' : item.raw || '';
				const itemLines = wrap(text, Math.max(width - 3, 20));
				result.push(` ${bullet} ${itemLines[0]}`);
				for (let j = 1; j < itemLines.length; j++) {
					result.push(`   ${itemLines[j]}`);
				}
			}
			return result;
		}
		case 'space':
			return [''];
		case 'hr':
			return [ansi('─'.repeat(Math.min(width, 40)), dim())];
		default: {
			const text = 'text' in token ? (token as { text: string }).text : token.raw || '';
			return wrap(text, width);
		}
	}
}

export function renderMarkdown(md: string, width: number): string[] {
	if (!md) return [''];
	const lines: string[] = [];
	try {
		const tokens = marked.lexer(md);
		for (const token of tokens) {
			const rendered = renderToken(token, width);
			lines.push(...rendered);
		}
	} catch {
		const parsed = marked.parseInline(md) as string;
		return wrap(parsed.replace(/<[^>]+>/g, ''), width);
	}
	return lines;
}

export function renderReasoning(text: string, width: number): string[] {
	const indent = Math.min(4, Math.max(2, Math.floor(width * 0.05)));
	const contentWidth = Math.max(width - indent, 20);
	const lines = renderMarkdown(text, contentWidth);
	return lines.map((l) => ansi(' '.repeat(indent) + l, dim()));
}

export function renderToolCall(name: string, args: Record<string, unknown>, width: number): string[] {
	const header = ansi(`[${name}]`, bold());
	const argsStr = JSON.stringify(args, null, 2);
	const argsLines = argsStr.split('\n').map((l: string) => ansi(`   ${l}`, dim()));
	return [header, ...argsLines];
}

export function renderToolResult(name: string, success: boolean, output: string, width: number): string[] {
	const status = success ? ansi('[OK]', bold()) : ansi('[FAIL]', bold());
	const header = `${status} ${name}`;
	const lines = [header];
	if (output) {
		const maxLines = 20;
		const outputLines = output.split('\n').slice(0, maxLines);
		for (const l of outputLines) {
			lines.push(ansi(`   ${l.slice(0, width - 3)}`, dim()));
		}
		if (output.split('\n').length > maxLines) {
			lines.push(ansi(`   ... (${output.split('\n').length - maxLines} more lines)`, dim()));
		}
	}
	return lines;
}
