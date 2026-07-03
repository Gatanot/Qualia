import { marked } from 'marked';
import type { Token } from 'marked';
import hljs from 'highlight.js';
import { reset, bold, dim, italic, underline, fg, bg } from './terminal.js';
import { P } from './palette.js';
import { stripHtmlTags } from './dfa.js';

export function charWidth(cp: number): number {
	if (cp === 0) return 0;
	if (cp < 0x20) return 0;
	if (cp < 0x7F) return 1;
	if (cp >= 0x1100 && cp <= 0x115F) return 2;
	if (cp >= 0x2E80 && cp <= 0xA4CF) return 2;
	if (cp >= 0xAC00 && cp <= 0xD7A3) return 2;
	if (cp >= 0xF900 && cp <= 0xFAFF) return 2;
	if (cp >= 0xFE10 && cp <= 0xFE19) return 2;
	if (cp >= 0xFE30 && cp <= 0xFE6F) return 2;
	if (cp >= 0xFF01 && cp <= 0xFF60) return 2;
	if (cp >= 0xFFE0 && cp <= 0xFFE6) return 2;
	if (cp >= 0x1F300 && cp <= 0x1F9FF) return 2;
	return 1;
}

export function strWidth(str: string): number {
	let w = 0;
	for (let i = 0; i < str.length; i++) {
		w += charWidth(str.codePointAt(i) || str.charCodeAt(i));
	}
	return w;
}

export function truncateToWidth(str: string, maxWidth: number): string {
	let w = 0;
	for (let i = 0; i < str.length; i++) {
		const cw = charWidth(str.codePointAt(i) || str.charCodeAt(i));
		if (w + cw > maxWidth) return str.slice(0, i);
		w += cw;
	}
	return str;
}

function ansi(s: string, ...codes: string[]): string {
	if (!s) return s;
	return codes.join('') + s + reset();
}

function wrap(text: string, width: number): string[] {
	if (!text) return [''];
	const lines: string[] = [];
	for (const paragraph of text.split('\n')) {
		if (strWidth(paragraph) <= width) {
			lines.push(paragraph);
			continue;
		}
		let remaining = paragraph;
		while (remaining.length > 0) {
			if (strWidth(remaining) <= width) {
				lines.push(remaining);
				break;
			}
			let cut = 0;
			let w = 0;
			for (let i = 0; i < remaining.length; i++) {
				const cw = charWidth(remaining.codePointAt(i) || remaining.charCodeAt(i));
				if (w + cw > width) break;
				w += cw;
				cut = i + 1;
			}
			if (cut === 0) cut = 1;
			const spaceIdx = remaining.lastIndexOf(' ', cut);
			if (spaceIdx > 0) cut = spaceIdx;
			lines.push(remaining.slice(0, cut));
			remaining = remaining.slice(cut).trimStart();
		}
	}
	return lines;
}

function renderToken(token: Token, width: number): string[] {
	switch (token.type) {
		case 'heading': {
			const prefix = '#'.repeat(token.depth);
			const text = `${prefix} ${token.text}`;
			const color = token.depth <= 2 ? P('textEmphasized') : P('text');
			return wrap(ansi(text, bold(), fg(color)), width);
		}
		case 'paragraph': {
			const tokens = 'tokens' in token ? token.tokens : [];
			if (!tokens || tokens.length === 0) {
				return wrap(ansi(token.text || '', fg(P('text'))), width);
			}
			let line = '';
			const result: string[] = [];
			for (const t of tokens) {
				if (t.type === 'text') {
					const text = 'tokens' in t ? (t as unknown as { text: string }).text : (t as { text?: string; raw?: string }).text || (t as { raw: string }).raw || '';
					line += ansi(text, fg(P('text')));
				} else if (t.type === 'strong') {
					line += ansi((t as { text: string }).text || '', bold(), fg(P('textEmphasized')));
				} else if (t.type === 'em') {
					line += ansi((t as { text: string }).text || '', italic(), fg(P('text')));
				} else if (t.type === 'codespan') {
					line += ansi((t as { text: string }).text || '', dim(), fg(P('textMuted')));
				} else if (t.type === 'link') {
					const link = t as { text: string; href: string };
					line += ansi(link.text || link.href, underline(), fg(P('link')));
				} else if (t.type === 'del') {
					line += ansi((t as { text: string }).text || '', dim(), fg(P('textMuted')));
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
			return lines.map((l: string) => ansi(l, dim(), fg(P('textMuted'))));
		}
		case 'blockquote': {
			const text = 'tokens' in token ? (token as { text: string }).text : token.raw || '';
			const lines = wrap(text, Math.max(width - 2, 20));
			return lines.map((l) => fg(P('borderNormal')) + '┃' + reset() + ' ' + ansi(l, fg(P('textMuted')), italic()));
		}
		case 'list': {
			const result: string[] = [];
			for (let i = 0; i < token.items.length; i++) {
				const item = token.items[i];
				const bullet = token.ordered ? `${token.start + i}.` : '•';
				const text = 'tokens' in item ? (item as { text: string }).text || item.raw || '' : item.raw || '';
				const itemLines = wrap(text, Math.max(width - 3, 20));
				result.push(ansi(` ${bullet} ${itemLines[0]}`, fg(P('text'))));
				for (let j = 1; j < itemLines.length; j++) {
					result.push(ansi(`   ${itemLines[j]}`, fg(P('text'))));
				}
			}
			return result;
		}
		case 'space':
			return [''];
		case 'hr':
			return [ansi('─'.repeat(Math.min(width, 60)), dim(), fg(P('borderNormal')))];
		default: {
			const text = 'text' in token ? (token as { text: string }).text : token.raw || '';
			return wrap(ansi(text, fg(P('text'))), width);
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
		return wrap(stripHtmlTags(parsed as string), width);
	}
	return lines;
}

export function renderReasoning(text: string, width: number): string[] {
	const indent = Math.min(4, Math.max(2, Math.floor(width * 0.05)));
	const contentWidth = Math.max(width - indent, 20);
	const lines = renderMarkdown(text, contentWidth);
	const bgReasoning = bg(P('bgDarker'));
	return lines.map((l) => bgReasoning + ' '.repeat(indent) + ansi(l, dim(), fg(P('reasoning'))) + reset());
}

export function renderToolCall(name: string, args: Record<string, unknown>, width: number): string[] {
	const header = ansi(`[${name}]`, bold(), fg(P('toolName')));
	const argsStr = JSON.stringify(args, null, 2);
	const maxW = Math.max(width - 3, 20);
	const argsLines = argsStr.split('\n').map((l: string) => {
		const truncated = truncateToWidth(l, maxW);
		return ansi(`   ${truncated}`, fg(P('text')));
	});
	return [header, ...argsLines];
}

export function renderToolResult(name: string, success: boolean, output: string, width: number): string[] {
	const statusColor = success ? P('success') : P('error');
	const status = ansi(success ? '[OK]' : '[FAIL]', bold(), fg(statusColor));
	const header = `${status} ${name}`;
	const lines = [header];
	if (output) {
		const maxLines = 20;
		const maxW = Math.max(width - 3, 20);
		const outputLines = output.split('\n').slice(0, maxLines);
		for (const l of outputLines) {
			lines.push(ansi(`   ${truncateToWidth(l, maxW)}`, fg(P('textMuted'))));
		}
		if (output.split('\n').length > maxLines) {
			lines.push(ansi(`   ... (${output.split('\n').length - maxLines} more lines)`, dim(), fg(P('textMuted'))));
		}
	}
	return lines;
}
