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

function renderHighlightedHtml(html: string, theme: SyntaxTheme): string {
	let output = '';
	let textBuffer = '';
	const scopes: Array<string | undefined> = [];

	const flush = () => {
		if (!textBuffer) return;
		let fmt: SyntaxFormatter | undefined;
		for (let i = scopes.length - 1; i >= 0; i--) {
			const scope = scopes[i];
			if (scope) {
				// Try exact match, then prefix match on '.' and '-'
				const dotIdx = scope.indexOf('.');
				const dashIdx = scope.indexOf('-');
				fmt = theme[scope];
				if (!fmt && dotIdx !== -1) fmt = theme[scope.slice(0, dotIdx)];
				if (!fmt && dashIdx !== -1) fmt = theme[scope.slice(0, dashIdx)];
				if (fmt) break;
			}
		}
		output += fmt ? fmt(textBuffer) : textBuffer;
		textBuffer = '';
	};

	let i = 0;
	while (i < html.length) {
		if (html.startsWith('<span', i)) {
			const nextChar = html[i + 5];
			if (nextChar === '>' || nextChar === ' ') {
				const tagEnd = html.indexOf('>', i + 5);
				if (tagEnd !== -1) {
					flush();
					const tag = html.slice(i, tagEnd + 1);
					const m = /\sclass\s*=\s*["']([^"']*)["']/.exec(tag);
					if (m) {
						for (const cls of m[1].split(/\s+/)) {
							if (cls.startsWith(HLJS_PREFIX)) {
								scopes.push(cls.slice(HLJS_PREFIX.length));
								break;
							}
						}
					} else {
						scopes.push(undefined);
					}
					i = tagEnd + 1;
					continue;
				}
			}
		}
		if (html.startsWith('</span>', i)) {
			flush();
			if (scopes.length > 0) scopes.pop();
			i += 7;
			continue;
		}
		if (html[i] === '&') {
			const entityEnd = html.indexOf(';', i);
			if (entityEnd !== -1 && entityEnd - i < 10) {
				const entity = html.slice(i + 1, entityEnd);
				const decoded: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
				textBuffer += decoded[entity] ?? html.slice(i, entityEnd + 1);
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
