import type { PendingConfirmation } from '@gatanot/qualia_core/tool';
import type { Component } from './tui.js';
import { theme } from './theme.js';
import { decodeKittyPrintable } from './keys.js';
import { visibleWidth } from './utils.js';

/**
 * ConfirmInline — a single-line confirm prompt rendered inline above the editor.
 */
export class ConfirmInline implements Component {
	public onResponse?: (approved: boolean) => void;

	private confirmation: PendingConfirmation;

	constructor(confirmation: PendingConfirmation) {
		this.confirmation = confirmation;
	}

	invalidate(): void {}

	handleInput(data: string): void {
		const printable = decodeKittyPrintable(data);
		const ch = printable !== undefined ? printable : data;
		if (ch === '\x1b') {
			this.onResponse?.(false);
			return;
		}
		if (ch.toLowerCase() === 'y' || ch === '\r' || ch === '\n') {
			this.onResponse?.(true);
			return;
		}
		if (ch.toLowerCase() === 'n') {
			this.onResponse?.(false);
			return;
		}
	}

	render(width: number): string[] {
		const fg = (key: string, text: string) => theme.fg(key, text);

		const label = fg('warning', '⚠');
		const tool = fg('accent', this.confirmation.toolName);
		const reason = fg('muted', this.confirmation.reason);
		const hint = fg('muted', '[Y] Confirm  [N/Esc] Deny');

		const left = ` ${label} ${tool}: ${reason}`;
		const leftWidth = visibleWidth(left);

		const minHintWidth = visibleWidth(hint);
		const availForLeft = width - minHintWidth - 1;

		let line: string;
		if (leftWidth <= availForLeft) {
			const pad = width - leftWidth - minHintWidth;
			line = left + ' '.repeat(Math.max(0, pad)) + hint;
		} else {
			const shortReason = fg('muted', this.confirmation.reason.slice(0, availForLeft - visibleWidth(` ${label} ${tool}: `) - 2));
			line = ` ${label} ${tool}: ${shortReason}…` + hint;
		}

		const vw = visibleWidth(line);
		if (vw < width) line += ' '.repeat(width - vw);

		return [line];
	}
}
