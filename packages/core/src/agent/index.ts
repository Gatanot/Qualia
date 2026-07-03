/**
 * Agent 模块
 *
 * Agent 主循环 + 上下文构建器，是对话链路的核心编排层。
 * ContextBuilder 拼装 system prompt / 历史 / 工具定义；
 * AgentLoop 驱动 LLM 流式调用 → tool_calls 执行 → 循环直到产生最终回复。
 *
 * @module agent
 */

export { AgentLoop } from './loop.js';
export { ContextBuilder } from './context-builder.js';
export { generateSummary } from './summarizer.js';
export { generateDiary } from './diary.js';
export { runSummarizeJob } from './background.js';
export type { SummarizeResult } from './background.js';
export type { AgentEvent, BuildResult, ConfirmFn, LoopHooks } from './types.js';
export { AgentState } from './types.js';
export { DEFAULT_SYSTEM_PROMPT, SYSTEM_CONTEXT } from './prompts.js';
export { sanitizeMessages } from './message-sanitizer.js';
export { AgentLogger } from './logger.js';
export { createSummarizeWorker } from './summarize-worker.js';
