import type { Usage, Message } from '$lib/provider';
import type { PendingConfirmation } from '$lib/tool';

/**
 * Agent 运行时流式事件
 *
 * API 路由将每种事件通过 SSE 推送到前端。
 */
export type AgentEvent =
	/** 流式文本增量 */
	| { type: 'content'; text: string }
	/** 流式思维链增量 */
	| { type: 'reasoning'; text: string }
	/** LLM 发起的工具调用 */
	| { type: 'tool_call'; name: string; args: Record<string, unknown> }
	/** 工具执行结果 */
	| { type: 'tool_result'; name: string; success: boolean; output: string }
	/** 需要用户确认的操作 */
	| { type: 'confirm_required'; confirmId: string; confirmation: PendingConfirmation }
	/** 错误 */
	| { type: 'error'; message: string }
	/** 会话分叉 */
	| { type: 'forked'; newSessionId: string; summary: string }
	/** 本轮对话完成 */
	| { type: 'done'; messageId: string; usage?: Usage }
	/** LLM 调用失败，正在重试 */
	| { type: 'retrying'; attempt: number; maxRetries: number }
	/** 所有重试均已失败 */
	| { type: 'retry_exhausted'; message: string; partialContent: boolean };

/** ContextBuilder.build() 的返回值 */
export interface BuildResult {
	/** 可直接传入 provider.chat 的消息列表 */
	messages: Message[];
	/** 如果触发了分叉，包含新会话信息 */
	forked?: { newSessionId: string; summary: string };
}

/** 确认回调函数签名 */
export type ConfirmFn = (confirmation: PendingConfirmation, confirmId: string) => Promise<boolean>;
