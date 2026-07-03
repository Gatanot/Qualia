import type { AgentEvent } from '@gatanot/qualia_core/agent';
import { summarizeEvent } from '../runtime/events.js';

const CSI = '\x1b[';

export function bold(text: string): string {
	return `${CSI}1m${text}${CSI}0m`;
}

export function dim(text: string): string {
	return `${CSI}2m${text}${CSI}0m`;
}

export function cyan(text: string): string {
	return `${CSI}36m${text}${CSI}0m`;
}

export function red(text: string): string {
	return `${CSI}31m${text}${CSI}0m`;
}

export function renderHeader(options: {
	modelId?: string;
	workspace: string;
	sessionId?: string;
}): string {
	const parts = ['Qualia CLI'];
	if (options.modelId) parts.push(options.modelId);
	if (options.sessionId) parts.push(`session ${options.sessionId}`);
	parts.push(options.workspace);
	return `${bold(parts.join(' · '))}\n输入 /exit 退出，Ctrl+C 可取消当前回答。\n\n`;
}

export function renderEvent(event: AgentEvent): string | undefined {
	switch (event.type) {
		case 'content':
			return event.text;
		case 'reasoning':
			return dim(event.text);
		case 'tool_call':
			return `\n${cyan(`工具调用：${event.name}`)}\n${dim(JSON.stringify(event.args, null, 2))}\n`;
		case 'tool_result':
			return `\n${event.success ? cyan('工具完成') : red('工具失败')}：${event.name}\n${dim(limit(event.output, 2000))}\n`;
		case 'tool_execution_update':
			return dim(event.text);
		case 'done':
			return '\n';
		default: {
			const summary = summarizeEvent(event);
			return summary ? `\n${dim(summary)}\n` : undefined;
		}
	}
}

function limit(text: string, max: number): string {
	if (text.length <= max) return text;
	return `${text.slice(0, max)}\n... 已截断 ${text.length - max} 字符`;
}
