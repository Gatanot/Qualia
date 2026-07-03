/**
 * 调色板 — 三层色彩深度 + 状态色
 * 参考 OpenCode 的 Theme 接口设计
 */
import { fg, bg, bold, dim, italic, underline, reset } from './terminal.js';

export interface Palette {
	primary: number;
	secondary: number;
	accent: number;

	text: number;
	textMuted: number;
	textEmphasized: number;

	bg: number;
	bgSecondary: number;
	bgDarker: number;

	borderNormal: number;
	borderDim: number;

	success: number;
	error: number;
	warning: number;
	info: number;

	toolName: number;
	reasoning: number;
	link: number;
}

export const DARK_PALETTE: Palette = {
	primary: 75,
	secondary: 180,
	accent: 213,

	text: 252,
	textMuted: 241,
	textEmphasized: 15,

	bg: 234,
	bgSecondary: 237,
	bgDarker: 232,

	borderNormal: 240,
	borderDim: 236,

	success: 42,
	error: 196,
	warning: 220,
	info: 39,

	toolName: 75,
	reasoning: 243,
	link: 39,
};

export const LIGHT_PALETTE: Palette = {
	primary: 26,
	secondary: 24,
	accent: 165,

	text: 235,
	textMuted: 243,
	textEmphasized: 232,

	bg: 255,
	bgSecondary: 253,
	bgDarker: 250,

	borderNormal: 245,
	borderDim: 250,

	success: 34,
	error: 160,
	warning: 214,
	info: 33,

	toolName: 26,
	reasoning: 243,
	link: 33,
};

let current: Palette = DARK_PALETTE;

export function getPalette(): Palette {
	return current;
}

export function setPalette(p: Palette): void {
	current = p;
}

export function P(t: keyof Palette): number {
	return current[t];
}

export function style(text: string, fgColor: number, ...codes: string[]): string {
	if (!text) return text;
	return codes.join('') + fg(fgColor) + text + reset();
}

export function styleBg(text: string, fgColor: number, bgColor: number, ...codes: string[]): string {
	if (!text) return text;
	return codes.join('') + fg(fgColor) + bg(bgColor) + text + reset();
}
