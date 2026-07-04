import { Box, Container, Markdown, type MarkdownTheme, Spacer, Text, truncateToWidth, visibleWidth } from './index.js';
import { theme } from './theme.js';

const MAX_OUTPUT = 5000;
const PREVIEW_LINES = 5;

function extractKeyArg(name: string, args: Record<string, unknown>): string {
	const keys = Object.keys(args);
	if (keys.length === 0) return '';

	if (name === 'exec' || name === 'bash') {
		const cmd = args['command'];
		return typeof cmd === 'string' ? `$ ${cmd}` : '';
	}
	if (name === 'read' || name === 'read_file') {
		const p = args['path'] ?? args['file_path'];
		return typeof p === 'string' ? p : '';
	}
	if (name === 'write' || name === 'write_file') {
		const p = args['path'] ?? args['file_path'];
		return typeof p === 'string' ? p : '';
	}
	if (name === 'search' || name === 'grep') {
		const p = args['pattern'];
		return typeof p === 'string' ? `"${p}"` : '';
	}
	if (name === 'list' || name === 'ls') {
		const p = args['path'];
		return typeof p === 'string' ? p : '';
	}

	const firstKey = keys[0];
	return `${firstKey}: ${JSON.stringify(args[firstKey])}`;
}

export class ToolExecutionComponent extends Container {
	private contentBox: Box;
	private toolName: string;
	private toolCallId: string;
	private args: Record<string, unknown>;
	private executionStarted = false;
	private outputParts: string[] = [];
	private expanded: boolean;
	private resultSuccess?: boolean;
	private resultOutput?: string;
	private keyArg: string;

	constructor(
		toolName: string,
		toolCallId: string,
		args: Record<string, unknown>,
		mkTheme: MarkdownTheme,
		expanded = false,
	) {
		super();
		this.toolName = toolName;
		this.toolCallId = toolCallId;
		this.args = args;
		this.expanded = expanded;
		this.keyArg = extractKeyArg(toolName, args);

		this.contentBox = new Box(1, 1, (s) => theme.bg('toolPending', s));
		this.addChild(new Spacer(1));
		this.addChild(this.contentBox);
		this.updateDisplay();
	}

	updateArgs(args: Record<string, unknown>): void {
		this.args = args;
		this.keyArg = extractKeyArg(this.toolName, args);
		this.updateDisplay();
	}

	markExecutionStarted(): void { this.executionStarted = true; this.updateDisplay(); }

	appendOutput(text: string): void {
		this.outputParts.push(text);
		this.updateDisplay();
	}

	finish(success: boolean, output: string): void {
		this.resultSuccess = success;
		this.resultOutput = output;
		this.updateDisplay();
	}

	setExpanded(expanded: boolean): void { this.expanded = expanded; this.updateDisplay(); }
	override invalidate(): void { super.invalidate(); this.updateDisplay(); }

	private updateDisplay(): void {
		const bgFn = this.resultSuccess === undefined
			? (s: string) => theme.bg('toolPending', s)
			: this.resultSuccess
				? (s: string) => theme.bg('toolSuccess', s)
				: (s: string) => theme.bg('toolError', s);

		this.contentBox.setBgFn(bgFn);
		this.contentBox.clear();

		const nameText = theme.bold(theme.fg('accent', `\`${this.toolName}\``));

		if (!this.expanded && this.resultSuccess !== undefined) {
			// Compact completed: one line
			const status = this.resultSuccess
				? theme.fg('success', ' OK')
				: theme.fg('error', ' FAIL');
			let line = `${nameText}${status}`;
			if (this.keyArg) line += '  ' + theme.fg('muted', this.keyArg);
			this.contentBox.addChild(new Text(line, 0, 0));
			return;
		}

		if (!this.expanded) {
			// Compact running: tool name + key arg + status
			let line = nameText;
			if (this.executionStarted && this.resultSuccess === undefined) {
				line += ' ' + theme.fg('muted', 'Running...');
			}
			if (this.keyArg) line += '  ' + theme.fg('muted', this.keyArg);
			this.contentBox.addChild(new Text(line, 0, 0));
			return;
		}

		// Expanded mode: full details
		let title = nameText;
		if (this.executionStarted && this.resultSuccess === undefined) {
			title += ' ' + theme.fg('muted', 'Running...');
		}
		this.contentBox.addChild(new Text(title, 0, 0));

		if (this.args && Object.keys(this.args).length > 0) {
			const argsStr = JSON.stringify(this.args, null, 2);
			this.contentBox.addChild(new Text(theme.fg('muted', argsStr), 1, 0));
		}

		const streaming = this.outputParts.join('');
		if (streaming && this.resultSuccess === undefined) {
			this.contentBox.addChild(new Text(theme.fg('muted', streaming.slice(0, MAX_OUTPUT)), 1, 0));
		}

		if (this.resultSuccess !== undefined && this.resultOutput) {
			this.contentBox.addChild(new Spacer(1));
			const statusLine = theme.bold(
				this.resultSuccess ? theme.fg('success', 'OK') : theme.fg('error', 'FAIL'),
			);
			const text = this.resultOutput.slice(0, MAX_OUTPUT);
			this.contentBox.addChild(new Text(statusLine + '\n' + text, 0, 0));
		}
	}
}
