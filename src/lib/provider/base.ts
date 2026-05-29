import type { ChatRequest, ChatResponse, StreamChunk } from './types';

export interface AIProvider {
	chat(request: ChatRequest): Promise<ChatResponse>;
	chatStream(request: ChatRequest): AsyncGenerator<StreamChunk>;
}
