import { Box, Container, Markdown, type MarkdownTheme } from './index.js';
import { theme } from './theme.js';

const OSC133_ZONE_START = '\x1b]133;A\x07';
const OSC133_ZONE_END = '\x1b]133;B\x07';
const OSC133_ZONE_FINAL = '\x1b]133;C\x07';

export class UserMessageComponent extends Container {
	private text: string;
	private mkTheme: MarkdownTheme;
	private outputPad: number;

	constructor(text: string, mkTheme: MarkdownTheme, outputPad = 1) {
		super();
		this.text = text;
		this.mkTheme = mkTheme;
		this.outputPad = outputPad;
		this.rebuild();
	}

	setOutputPad(pad: number): void { this.outputPad = pad; this.rebuild(); }

	private rebuild(): void {
		this.clear();
		const box = new Box(this.outputPad, 1, (s) => theme.bg('userBg', s));
		box.addChild(new Markdown(this.text, 0, 0, this.mkTheme, {
			color: (s) => theme.fg('text', s),
		}, { preserveOrderedListMarkers: true, preserveBackslashEscapes: true }));
		this.addChild(box);
	}

	override render(width: number): string[] {
		const lines = super.render(width);
		if (lines.length === 0) return lines;
		lines[0] = OSC133_ZONE_START + lines[0];
		lines[lines.length - 1] = OSC133_ZONE_END + OSC133_ZONE_FINAL + lines[lines.length - 1];
		return lines;
	}
}
