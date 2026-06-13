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
 * import { createProvider } from '$lib/ai';
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

export type { AIProvider } from './base';
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
} from './types';
export { OpenAIProvider } from './openai';
export type { OpenAIConfig } from './openai';
export { DeepSeekProvider } from './deepseek';
export type { DeepSeekConfig } from './deepseek';
export { XiaomiProvider } from './xiaomi';
export type { XiaomiConfig } from './xiaomi';
export { OllamaProvider } from './ollama';
export type { OllamaConfig } from './ollama';
export { createProvider } from './factory';
export type { ModelDef } from './models';
export { getDefaultModels, OPENAI_MODELS, DEEPSEEK_MODELS, XIAOMI_MODELS } from './models';
export { ProviderError, fetchWithRetry, parseSSEStream, parseUsage, sleep } from './utils';
