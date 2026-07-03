/**
 * Provider 模块
 *
 * 管理不同来源的 AI API 接入，向上层暴露统一的流式/非流式调用接口。
 * 当前支持 OpenAI 兼容格式。
 *
 * @module ai
 *
 * @example 基本用法
 * ```ts
 * import { createProvider } from './index.js';
 *
 * const ai = createProvider({
 *   type: 'openai',
 *   apiKey: 'sk-xxx',
 *   baseURL: 'https://api.openai.com/v1',
 *   model: 'gpt-4o'
 * });
 *
 * // 非流式
 * const result = await ai.chat({ messages: [{ role: 'user', content: 'Hello' }] });
 *
 * // 流式
 * for await (const chunk of ai.chatStream({ messages: [...] })) {
 *   process.stdout.write(chunk.content);
 * }
 * ```
 */

export type { AIProvider } from './base.js';
export type {
	Message,
	TextContent,
	ImageContent,
	ContentPart,
	ToolCall,
	ToolCallDelta,
	Tool,
	ChatRequest,
	ChatResponse,
	StreamChunk,
	Usage
} from './types.js';
export { OpenAIProvider } from './openai.js';
export type { OpenAIConfig } from './openai.js';
export { DeepSeekProvider } from './deepseek.js';
export type { DeepSeekConfig } from './deepseek.js';
export { XiaomiProvider } from './xiaomi.js';
export type { XiaomiConfig } from './xiaomi.js';
export { OllamaProvider } from './ollama.js';
export type { OllamaConfig } from './ollama.js';
export { createProvider } from './factory.js';
export type { ModelDef } from './models.js';
export { getDefaultModels, OPENAI_MODELS, DEEPSEEK_MODELS, XIAOMI_MODELS } from './models.js';
export { ProviderError, fetchWithRetry, parseSSEStream, parseUsage, sleep } from './utils.js';
