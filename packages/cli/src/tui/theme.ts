import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import chalk from 'chalk';
import hljs from 'highlight.js';
import type { MarkdownTheme } from './index.js';

/**
 * Maps CLI palette key → theme color name.
 * Falls back to using the key directly as a color name in the theme config.
 */
const KEY_MAP: Record<string, string> = {
	accent:       'accent',
	text:         'text-primary',
	muted:        'text-muted',
	dim:          'text-placeholder',
	heading:      'heading',
	link:         'link',
	codeBlock:    'codeBlock',
	quote:        'quote',
	listBullet:   'listBullet',
	border:       'border-input',
	success:      'status-done',
	error:        'status-error',
	warning:      'status-pending',
	thinking:     'thinking',
	userBg:       'user-msg-bg',
	toolPending:  'tool-pending-bg',
	toolSuccess:  'tool-success-bg',
	toolError:    'tool-error-bg',
};

const defaults: Record<string, string> = {
	accent:       '#9C8C78',
	text:         '#E9E3DA',
	muted:        '#716961',
	dim:          '#5B544D',
	heading:      '#f0c674',
	link:         '#81a2be',
	codeBlock:    '#D5CBBE',
	quote:        '#716961',
	listBullet:   '#9C8C78',
	border:       '#3B3530',
	success:      '#10b981',
	error:        '#ef4444',
	warning:      '#f59e0b',
	thinking:     '#716961',
	userBg:       '#343541',
	toolPending:  '#282832',
	toolSuccess:  '#283228',
	toolError:    '#3c2828',
};

const active: Record<string, string> = { ...defaults };

function loadUserTheme(): void {
	try {
		const userPath = join(homedir(), '.qualia', 'theme.json');
		const raw = readFileSync(userPath, 'utf8');
		const parsed = JSON.parse(raw);
		if (parsed?.colors && typeof parsed.colors === 'object') {
			for (const cliKey of Object.keys(defaults)) {
				const colorName = KEY_MAP[cliKey] ?? cliKey;
				const entry = parsed.colors[colorName];
				if (entry?.dark && typeof entry.dark === 'string') {
					active[cliKey] = entry.dark;
				}
			}
		}
	} catch {}
}

loadUserTheme();

function hexRgb(hex: string): [number, number, number] {
	const v = parseInt(hex.slice(1), 16);
	return [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
}

const fgCache = new Map<string, string>();
const bgCache = new Map<string, string>();

function fgAnsi(hex: string): string {
	let c = fgCache.get(hex);
	if (!c) { const [r, g, b] = hexRgb(hex); c = `\x1b[38;2;${r};${g};${b}m`; fgCache.set(hex, c); }
	return c;
}

function bgAnsi(hex: string): string {
	let c = bgCache.get(hex);
	if (!c) { const [r, g, b] = hexRgb(hex); c = `\x1b[48;2;${r};${g};${b}m`; bgCache.set(hex, c); }
	return c;
}

export const theme = {
	fg(name: string, text: string): string {
		const hex = active[name] ?? name;
		return fgAnsi(hex) + text + '\x1b[39m';
	},
	bg(name: string, text: string): string {
		const hex = active[name] ?? name;
		return bgAnsi(hex) + text + '\x1b[49m';
	},
	bold: (t: string) => chalk.bold(t),
	italic: (t: string) => chalk.italic(t),
	underline: (t: string) => chalk.underline(t),
};

type SyntaxFormatter = (text: string) => string;
type SyntaxTheme = Partial<Record<string, SyntaxFormatter>>;

const SYNTAX_THEME: SyntaxTheme = {
	keyword:      (s) => theme.fg('accent', s),
	built_in:     (s) => theme.fg('accent', s),
	type:         (s) => theme.fg('link', s),
	string:       (s) => theme.fg('success', s),
	number:       (s) => theme.fg('warning', s),
	literal:      (s) => theme.fg('success', s),
	regexp:       (s) => theme.fg('success', s),
	comment:      (s) => theme.fg('dim', s),
	'function':   (s) => theme.fg('heading', s),
	title:        (s) => theme.bold(theme.fg('text', s)),
	params:       (s) => theme.fg('muted', s),
	attr:         (s) => theme.fg('link', s),
	variable:     (s) => theme.fg('link', s),
	meta:         (s) => theme.fg('muted', s),
	punctuation:  (s) => theme.fg('muted', s),
	operator:     (s) => theme.fg('muted', s),
	doctag:       (s) => theme.fg('dim', s),
	emphasis:     (s) => theme.italic(s),
	strong:       (s) => theme.bold(s),
};

const HLJS_PREFIX = 'hljs-';

function extractSpanScope(tag: string): string | undefined {
	// DFA: find class="..." or class='...' in a <span ...> tag
	let i = 0;
	while (i < tag.length) {
		if (tag[i] === 'c' && tag.slice(i, i + 6) === 'class=') {
			i += 6;
			const quote = tag[i];
			if (quote !== '"' && quote !== "'") continue;
			i++;
			let cls = '';
			while (i < tag.length && tag[i] !== quote) {
				cls += tag[i];
				i++;
			}
			// Split by whitespace, find hljs-xxx
			let start = 0;
			for (let j = 0; j <= cls.length; j++) {
				if (j === cls.length || cls[j] === ' ' || cls[j] === '\t' || cls[j] === '\n' || cls[j] === '\r') {
					const part = cls.slice(start, j);
					if (part.startsWith(HLJS_PREFIX)) return part.slice(HLJS_PREFIX.length);
					start = j + 1;
				}
			}
			return undefined;
		}
		i++;
	}
	return undefined;
}

function decodeHtmlEntity(entity: string): string | undefined {
	if (entity === 'amp') return '&';
	if (entity === 'lt') return '<';
	if (entity === 'gt') return '>';
	if (entity === 'quot') return '"';
	if (entity === 'apos') return "'";
	return undefined;
}

function renderHighlightedHtml(html: string, theme: SyntaxTheme): string {
	let output = '';
	let textBuffer = '';
	const scopes: Array<string | undefined> = [];

	const flush = () => {
		if (!textBuffer) return;
		let fmt: SyntaxFormatter | undefined;
		for (let idx = scopes.length - 1; idx >= 0; idx--) {
			const scope = scopes[idx];
			if (scope) {
				fmt = theme[scope];
				if (!fmt) {
					// Try prefix match: truncate at first '.' or '-'
					let end = scope.length;
					for (let k = 0; k < scope.length; k++) {
						if (scope[k] === '.' || scope[k] === '-') { end = k; break; }
					}
					if (end < scope.length) fmt = theme[scope.slice(0, end)];
				}
				if (fmt) break;
			}
		}
		output += fmt ? fmt(textBuffer) : textBuffer;
		textBuffer = '';
	};

	let i = 0;
	while (i < html.length) {
		if (html[i] === '<' && html.slice(i, i + 5) === '<span') {
			const nextChar = html[i + 5];
			if (nextChar === '>' || nextChar === ' ') {
				const tagEnd = html.indexOf('>', i + 5);
				if (tagEnd !== -1) {
					flush();
					const tag = html.slice(i, tagEnd + 1);
					const scope = extractSpanScope(tag);
					scopes.push(scope);
					i = tagEnd + 1;
					continue;
				}
			}
		}
		if (html[i] === '<' && html.slice(i, i + 7) === '</span>') {
			flush();
			if (scopes.length > 0) scopes.pop();
			i += 7;
			continue;
		}
		if (html[i] === '&') {
			let entityEnd = -1;
			for (let j = i + 1; j < html.length && j < i + 10; j++) {
				if (html[j] === ';') { entityEnd = j; break; }
			}
			if (entityEnd !== -1) {
				const entity = html.slice(i + 1, entityEnd);
				const decoded = decodeHtmlEntity(entity);
				textBuffer += decoded ?? html.slice(i, entityEnd + 1);
				i = entityEnd + 1;
				continue;
			}
		}
		textBuffer += html[i];
		i++;
	}
	flush();
	return output;
}

export function getMarkdownTheme(): MarkdownTheme {
	return {
		heading: (t) => theme.bold(theme.fg('heading', t)),
		link: (t) => theme.underline(theme.fg('link', t)),
		linkUrl: (t) => theme.fg('dim', t),
		code: (t) => theme.fg('accent', t),
		codeBlock: (t) => theme.fg('codeBlock', t),
		codeBlockBorder: (t) => theme.fg('muted', t),
		quote: (t) => theme.italic(theme.fg('quote', t)),
		quoteBorder: (t) => theme.fg('muted', t),
		hr: (t) => theme.fg('muted', t),
		listBullet: (t) => theme.fg('listBullet', t),
		bold: (t) => theme.bold(theme.fg('text', t)),
		italic: (t) => theme.italic(theme.fg('text', t)),
		strikethrough: (t) => chalk.strikethrough(theme.fg('muted', t)),
		underline: (t) => theme.underline(theme.fg('text', t)),
		highlightCode: (code: string, lang?: string): string[] => {
			const validLang = lang && hljs.getLanguage(lang) ? lang : undefined;
			if (!validLang) {
				return code.split('\n').map((line) => theme.fg('codeBlock', line));
			}
			try {
				const result = hljs.highlight(code, { language: validLang, ignoreIllegals: true });
				return renderHighlightedHtml(result.value, SYNTAX_THEME).split('\n');
			} catch {
				return code.split('\n').map((line) => theme.fg('codeBlock', line));
			}
		},
	};
}
