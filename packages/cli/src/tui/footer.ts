import type { Component } from './index.js';
import { visibleWidth } from './index.js';
import { theme } from './theme.js';

export interface FooterData {
	modelId: string;
	thinkingLevel?: string;
	totalInput?: number; totalOutput?: number;
	contextWindow?: number;
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

		const totalTokens = (d.totalInput || 0) + (d.totalOutput || 0);
		if (totalTokens > 0) {
			parts.push(`\u2195${fmt(totalTokens)}`);
		}

		const modelParts: string[] = [d.modelId];
		if (d.thinkingLevel && d.thinkingLevel !== 'off') {
			modelParts.push(d.thinkingLevel);
		}
		parts.push(modelParts.join(' \u2022 '));

		if (totalTokens > 0 && d.contextWindow && d.contextWindow > 0) {
			const pct = ((totalTokens / d.contextWindow) * 100).toFixed(1);
			parts.push(`${pct}%`);
		}

		const left = parts.join('  ');
		const lw = visibleWidth(left);

		let line: string;
		if (d.cwd) {
			const rw = visibleWidth(d.cwd);
			if (lw + rw + 2 <= width) {
				line = left + ' '.repeat(width - lw - rw) + d.cwd;
			} else {
				line = left;
			}
		} else {
			const vw = visibleWidth(left);
			line = vw < width ? left + ' '.repeat(width - vw) : left;
		}

		return [theme.fg('dim', line)];
	}
}
