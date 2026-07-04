import { Container, Markdown, type MarkdownTheme, Spacer, Text } from './index.js';
import { theme } from './theme.js';

const OSC133_ZONE_START = '\x1b]133;A\x07';
const OSC133_ZONE_END = '\x1b]133;B\x07';
const OSC133_ZONE_FINAL = '\x1b]133;C\x07';

export class AssistantMessageComponent extends Container {
	private contentContainer = new Container();
	private mkTheme: MarkdownTheme;
	private outputPad: number;
	private hideThinkingBlock: boolean;
	private hiddenThinkingLabel: string;

	private lastText = '';
	private lastReasoning = '';
	private stopReason?: string;
	private errorMessage?: string;
	private hasToolCalls = false;

	constructor(
		mkTheme: MarkdownTheme,
		outputPad = 1,
		hideThinkingBlock = false,
		hiddenThinkingLabel = '思考中...',
	) {
		super();
		this.mkTheme = mkTheme;
		this.outputPad = outputPad;
		this.hideThinkingBlock = hideThinkingBlock;
		this.hiddenThinkingLabel = hiddenThinkingLabel;
		this.addChild(this.contentContainer);
	}

	update(text: string, reasoning: string, opts?: { stopReason?: string; errorMessage?: string; hasToolCalls?: boolean }): void {
		this.lastText = text;
		this.lastReasoning = reasoning;
		if (opts) {
			this.stopReason = opts.stopReason;
			this.errorMessage = opts.errorMessage;
			this.hasToolCalls = !!opts.hasToolCalls;
		}
		this.rebuild();
	}

	setHideThinkingBlock(hide: boolean): void { this.hideThinkingBlock = hide; this.rebuild(); }
	setHiddenThinkingLabel(label: string): void { this.hiddenThinkingLabel = label; this.rebuild(); }
	setOutputPad(pad: number): void { this.outputPad = pad; this.rebuild(); }

	showError(msg: string): void {
		this.contentContainer.clear();
		this.contentContainer.addChild(new Spacer(1));
		this.contentContainer.addChild(new Text(theme.fg('error', msg), this.outputPad, 0));
	}

	override invalidate(): void { super.invalidate(); this.rebuild(); }

	override render(width: number): string[] {
		const lines = super.render(width);
		if (this.hasToolCalls || lines.length === 0) return lines;
		lines[0] = OSC133_ZONE_START + lines[0];
		lines[lines.length - 1] = OSC133_ZONE_END + OSC133_ZONE_FINAL + lines[lines.length - 1];
		return lines;
	}

	private rebuild(): void {
		this.contentContainer.clear();

		const hasText = this.lastText.trim();
		const hasReasoning = this.lastReasoning.trim();
		if (!hasText && !hasReasoning && !this.stopReason && !this.errorMessage) return;

		if (hasText || hasReasoning) this.contentContainer.addChild(new Spacer(1));

		if (hasReasoning) {
			if (this.hideThinkingBlock) {
				this.contentContainer.addChild(new Text(
					theme.italic(theme.fg('thinking', this.hiddenThinkingLabel)),
					this.outputPad, 0,
				));
			} else {
				this.contentContainer.addChild(new Markdown(
					this.lastReasoning.trim(), this.outputPad, 0, this.mkTheme,
					{ color: (s) => theme.fg('thinking', s), italic: true },
				));
			}
		}

		if (hasText) {
			if (hasReasoning) this.contentContainer.addChild(new Spacer(1));
			this.contentContainer.addChild(new Markdown(this.lastText.trim(), this.outputPad, 0, this.mkTheme));
		}

		if (!this.hasToolCalls && this.stopReason === 'length') {
			this.contentContainer.addChild(new Spacer(1));
			this.contentContainer.addChild(new Text(
				theme.fg('error', '错误：模型因达到最大输出 token 限制而停止，响应可能不完整。'),
				this.outputPad, 0,
			));
		} else if (!this.hasToolCalls && this.stopReason === 'aborted') {
			this.contentContainer.addChild(new Spacer(1));
			this.contentContainer.addChild(new Text(
				theme.fg('error', this.errorMessage || '操作已中止'),
				this.outputPad, 0,
			));
		} else if (!this.hasToolCalls && this.stopReason === 'error') {
			this.contentContainer.addChild(new Spacer(1));
			this.contentContainer.addChild(new Text(
				theme.fg('error', `错误：${this.errorMessage || '未知错误'}`),
				this.outputPad, 0,
			));
		}
	}
}
