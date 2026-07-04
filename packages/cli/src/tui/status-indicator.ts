import { Loader, TUI } from './index.js';
import { theme } from './theme.js';

export type StatusKind = 'working' | 'retry';

export class StatusIndicator extends Loader {
	readonly kind: StatusKind;

	constructor(kind: StatusKind, ui: TUI, message: string) {
		const spinnerColor = (s: string) => kind === 'working' ? theme.fg('accent', s) : theme.fg('warning', s);
		const msgColor = (s: string) => theme.fg('muted', s);
		super(ui, spinnerColor, msgColor, message);
		this.kind = kind;
		this.start();
	}

	dispose(): void {
		this.stop();
	}
}
