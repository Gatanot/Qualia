import type { Component } from './index.js';
import { truncateToWidth, visibleWidth } from './index.js';
import { theme } from './theme.js';

export interface FooterData {
	modelId: string; providerName?: string;
	thinkingLevel?: string;
	totalInput?: number; totalOutput?: number;
	cwd?: string;
}

function fmt(n: number): string {
	if (n < 1000) return n.toString();
	if (n < 10000) return `${(n / 1000).toFixed(1)}k`;
	if (n < 1_000_000) return `${Math.round(n / 1000)}k`;
	return `${Math.round(n / 1_000_000)}M`;
}

export class FooterComponent implements Component {
	private data: FooterData = { modelId: '' };
	setData(d: FooterData): void { this.data = d; }
	invalidate(): void {}

	render(width: number): string[] {
		const d = this.data;
		const parts: string[] = [];
		if (d.totalInput) parts.push(`\u2191${fmt(d.totalInput)}`);
		if (d.totalOutput) parts.push(`\u2193${fmt(d.totalOutput)}`);

		let right = d.modelId;
		if (d.thinkingLevel && d.thinkingLevel !== 'off') right = `${d.modelId} \u2022 ${d.thinkingLevel}`;
		if (d.providerName) right = `(${d.providerName}) ${right}`;

		let left = parts.join(' ');
		const lw = visibleWidth(left), rw = visibleWidth(right), gap = 3;

		let statsLine: string;
		if (lw + gap + rw <= width) {
			statsLine = left + ' '.repeat(width - lw - rw) + right;
		} else {
			const avail = width - lw - gap;
			if (avail > 0) {
				const tr = truncateToWidth(right, avail, '');
				statsLine = left + ' '.repeat(Math.max(0, width - lw - visibleWidth(tr))) + tr;
			} else {
				statsLine = truncateToWidth(left, width, '...');
			}
		}

		const lines: string[] = [];
		if (d.cwd) lines.push(truncateToWidth(theme.fg('dim', d.cwd), width, theme.fg('dim', '...')));
		lines.push(theme.fg('dim', statsLine));
		return lines;
	}
}
