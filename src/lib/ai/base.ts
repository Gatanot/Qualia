import type { ChatRequest, ChatResponse, StreamChunk } from './types';

/**
 * AI 供应商统一接口
 *
 * 所有 LLM API 接入实现此接口，向上层暴露统一的流式/非流式调用方式。
 */
export interface AIProvider {
	/**
	 * 发送非流式聊天请求，等待完整结果后返回
	 * @param request - 聊天请求参数
	 */
	chat(request: ChatRequest): Promise<ChatResponse>;

	/**
	 * 发送流式聊天请求，通过 AsyncGenerator 逐块返回增量数据
	 * @param request - 聊天请求参数
	 */
	chatStream(request: ChatRequest): AsyncGenerator<StreamChunk>;
}
