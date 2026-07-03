/**
 * 布局工具 — 边框、内边距、分隔线
 * 参考 OpenCode layout/container.go 和 PI components/box.ts
 */
import { fg, dim, reset } from './terminal.js';
import { P } from './palette.js';
import { charWidth } from './renderer.js';

/** 左竖线边框 (窄) */
export const BORDER_LEFT = '│';
/** 左竖线边框 (粗) */
export const BORDER_LEFT_HEAVY = '┃';
/** 横分隔线 */
export const BORDER_HR = '─';

export type BorderSide = 'left' | 'right' | 'top' | 'bottom';

export interface BorderOpts {
	sides: BorderSide[];
	color: number;
	char?: string;
}

export interface PadOpts {
	top?: number;
	bottom?: number;
	left?: number;
	right?: number;
}

export interface ContainerOpts {
	border?: BorderOpts;
	padding?: PadOpts;
	bgColor?: number;
	width: number;
}

function repeatChar(ch: string, count: number): string {
	if (count <= 0) return '';
	let result = '';
	for (let i = 0; i < count; i++) result += ch;
	return result;
}

function fillToWidth(line: string, width: number, bgColor?: number): string {
	const lineW = strDisplayWidth(line);
	if (lineW >= width) return line;
	const fill = repeatChar(' ', width - lineW);
	if (bgColor) {
		return line + '\x1b[48;5;' + bgColor + 'm' + fill + reset();
	}
	return line + fill;
}

export function strDisplayWidth(str: string): number {
	let w = 0;
	for (let i = 0; i < str.length; i++) {
		w += charWidth(str.codePointAt(i) || str.charCodeAt(i));
	}
	return w;
}

export function applyLeftBorder(lines: string[], color: number, ch: string = BORDER_LEFT): string[] {
	return lines.map((l) => {
		const prefix = fg(color) + ch + reset() + ' ';
		return prefix + l;
	});
}

export function applyPadding(lines: string[], opts: PadOpts, width: number, bgColor?: number): string[] {
	const result: string[] = [];
	const topPad = opts.top || 0;
	const bottomPad = opts.bottom || 0;
	const leftPad = opts.left || 0;
	const rightPad = opts.right || 0;

	for (let i = 0; i < topPad; i++) {
		result.push(fillToWidth('', width, bgColor));
	}

	const innerWidth = width - leftPad - rightPad;

	for (const line of lines) {
		const padded = ' '.repeat(leftPad) + line;
		result.push(fillToWidth(padded, width, bgColor));
	}

	for (let i = 0; i < bottomPad; i++) {
		result.push(fillToWidth('', width, bgColor));
	}

	return result;
}

export function horizontalRule(width: number, color?: number): string {
	const ch = BORDER_HR;
	const c = color ?? P('borderDim');
	return dim() + fg(c) + repeatChar(ch, Math.min(width, 60)) + reset();
}

export function topBorder(width: number, color?: number): string {
	const c = color ?? P('borderNormal');
	return dim() + fg(c) + '┌' + repeatChar('─', Math.max(0, width - 2)) + '┐' + reset();
}

export function bottomBorder(width: number, color?: number): string {
	const c = color ?? P('borderNormal');
	return dim() + fg(c) + '└' + repeatChar('─', Math.max(0, width - 2)) + '┘' + reset();
}

export function toolBox(lines: string[], width: number): string[] {
	const c = P('borderDim');
	const innerWidth = Math.max(width - 2, 20);
	const result: string[] = [topBorder(width, c)];
	for (const line of lines) {
		result.push(dim() + fg(c) + '│' + reset() + fillToWidth(' ' + line, innerWidth + 1));
	}
	result.push(bottomBorder(width, c));
	return result;
}
