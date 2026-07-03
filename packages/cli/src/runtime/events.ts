import type { AgentEvent } from '@gatanot/qualia_core/agent';

export interface TranscriptChunk {
	content: string;
	reasoning: string;
}

export function summarizeEvent(event: AgentEvent): string | undefined {
	switch (event.type) {
		case 'tool_call':
			return `调用工具：${event.name}`;
		case 'tool_result':
			return `${event.success ? '工具完成' : '工具失败'}：${event.name}`;
		case 'tool_execution_update':
			return event.text;
		case 'retrying':
			return `模型调用失败，正在重试 ${event.attempt}/${event.maxRetries}`;
		case 'retry_exhausted':
			return `重试耗尽：${event.message}`;
		case 'forked':
			return `会话已延续到：${event.newSessionId}`;
		case 'error':
			return `错误：${event.message}`;
		default:
			return undefined;
	}
}
