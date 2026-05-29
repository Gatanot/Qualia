/**
 * Agent 模块
 *
 * Agent 主循环 + 上下文构建器，是对话链路的核心编排层。
 * ContextBuilder 拼装 system prompt / 历史 / 工具定义；
 * AgentLoop 驱动 LLM 流式调用 → tool_calls 执行 → 循环直到产生最终回复。
 *
 * @module agent
 */

export { AgentLoop } from './loop';
export { ContextBuilder } from './context-builder';
export type { AgentEvent, BuildResult, ConfirmFn } from './types';
export { DEFAULT_SYSTEM_PROMPT } from './prompts';
