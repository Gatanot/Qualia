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
export { generateSummary } from './summarizer';
export { generateDiary } from './diary';
export { runSummarizeJob } from './background';
export type { SummarizeResult } from './background';
export type { AgentEvent, BuildResult, ConfirmFn, LoopHooks } from './types';
export { AgentState } from './types';
export { DEFAULT_SYSTEM_PROMPT, SYSTEM_CONTEXT } from './prompts';
export { sanitizeMessages } from './message-sanitizer';
export { AgentLogger } from './logger';
