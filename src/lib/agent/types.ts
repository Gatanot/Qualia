import type { Usage, Message } from '$lib/ai';
import type { PendingConfirmation } from '$lib/tool';

/**
 * AgentLoop 状态机状态枚举
 *
 * 每个状态对应循环中的一个确定阶段，状态转换时触发对应的 LoopHooks 回调。
 */
export enum AgentState {
	INIT = 'INIT',
	PRE_LLM = 'PRE_LLM',
	LLM_STREAMING = 'LLM_STREAMING',
	POST_LLM = 'POST_LLM',
	LLM_RETRY_WAIT = 'LLM_RETRY_WAIT',
	PRE_TOOL = 'PRE_TOOL',
	TOOL_EXECUTING = 'TOOL_EXECUTING',
	AWAIT_CONFIRM = 'AWAIT_CONFIRM',
	POST_TOOL = 'POST_TOOL',
	PERSIST_TURN = 'PERSIST_TURN',
	DONE = 'DONE',
	ERROR = 'ERROR',
}

/**
 * AgentLoop 生命周期钩子
 *
 * 在状态转换的关键节点调用，允许 extension 等外部模块注入自定义逻辑。
 * 所有钩子均为可选，默认无操作。
 */
export interface LoopHooks {
	/** LLM 调用前触发，可修改 messages 数组（返回新数组） */
	beforeLlmCall?(messages: Message[]): Promise<Message[]>;
	/** LLM 调用完成后触发 */
	afterLlmCall?(usage?: Usage): Promise<void>;
	/** LLM 重试时触发 */
	onLlmRetry?(attempt: number, maxRetries: number, error: Error): Promise<void>;
	/** 工具执行前触发，可修改参数（返回新 args） */
	beforeToolExecution?(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>>;
	/** 工具执行完成后触发 */
	afterToolExecution?(name: string, result: { success: boolean; output: string }): Promise<void>;
	/** 需要用户确认时触发 */
	onConfirmRequired?(confirmation: PendingConfirmation, confirmId: string): Promise<void>;
	/** 每轮对话结束后触发（persist 之前） */
	afterTurn?(iteration: number): Promise<void>;
}

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
	| { type: 'forked'; newSessionId: string }
	/** 本轮对话完成 */
	| { type: 'done'; messageId: string; usage?: Usage; contextWindow?: number }
	/** LLM 调用失败，正在重试 */
	| { type: 'retrying'; attempt: number; maxRetries: number }
	/** 所有重试均已失败 */
	| { type: 'retry_exhausted'; message: string; partialContent: boolean }
	/** 实时干预消息已消费，可从输入队列中移除 */
	| { type: 'steering_consumed'; messageId: string };

/** ContextBuilder.build() 的返回值 */
export interface BuildResult {
	/** 可直接传入 provider.chat 的消息列表 */
	messages: Message[];
	/** 当前模型的上下文窗口大小 */
	contextWindow?: number;
	/** 如果触发了分叉，包含新会话信息 */
	forked?: { newSessionId: string };
}

/** 确认回调函数签名 */
export type ConfirmFn = (confirmation: PendingConfirmation, confirmId: string) => Promise<boolean>;
