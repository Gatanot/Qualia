import chalk from 'chalk';
import type { MarkdownTheme } from './index.js';

// Exact pi-agent dark theme hex colors
const palette = {
	accent:     '#8abeb7',
	border:     '#5f87ff',
	success:    '#b5bd68',
	error:      '#cc6666',
	warning:    '#ffff00',
	muted:      '#808080',
	dim:        '#666666',
	text:       '#d4d4d4',
	thinking:   '#808080',
	heading:    '#f0c674',
	link:       '#81a2be',
	codeBlock:  '#b5bd68',
	quote:      '#808080',
	listBullet: '#8abeb7',
	userBg:     '#343541',
	toolPending:'#282832',
	toolSuccess:'#283228',
	toolError:  '#3c2828',
} as const;
type K = keyof typeof palette;

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
	fg(name: K, text: string): string {
		return fgAnsi(palette[name]) + text + '\x1b[39m';
	},
	bg(name: K, text: string): string {
		return bgAnsi(palette[name]) + text + '\x1b[49m';
	},
	bold: (t: string) => chalk.bold(t),
	italic: (t: string) => chalk.italic(t),
	underline: (t: string) => chalk.underline(t),
};

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
	};
}
