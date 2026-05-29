import type { AIProvider } from './base';
import type { ChatRequest, ChatResponse, ToolCall, StreamChunk, Usage } from './types';
import { fetchWithRetry, parseSSEStream, ProviderError, parseUsage } from './utils';

export interface OpenAIConfig {
	apiKey: string;
	baseURL: string;
	model: string;
	timeout?: number;
	maxRetries?: number;
}

export class OpenAIProvider implements AIProvider {
	private apiKey: string;
	private baseURL: string;
	private model: string;
	private timeout: number;
	private maxRetries: number;

	constructor(config: OpenAIConfig) {
		this.apiKey = config.apiKey;
		this.baseURL = config.baseURL.replace(/\/$/, '');
		this.model = config.model;
		this.timeout = config.timeout ?? 60_000;
		this.maxRetries = config.maxRetries ?? 2;
	}

	async chat(request: ChatRequest): Promise<ChatResponse> {
		const body = this.buildBody({ ...request, stream: false });

		const response = await fetchWithRetry(
			() => this.doFetch(body),
			this.maxRetries
		);

		const json = await response.json();
		return this.parseResponse(json);
	}

	async *chatStream(request: ChatRequest): AsyncGenerator<StreamChunk> {
		const body = this.buildBody({ ...request, stream: true });

		const response = await fetchWithRetry(
			() => this.doFetch(body),
			this.maxRetries
		);

		if (!response.body) {
			throw new ProviderError('Response body is empty', 0, null);
		}

		const reader = response.body.getReader();
		yield* parseSSEStream(reader);
	}

	private buildBody(request: ChatRequest & { stream: boolean }): string {
		return JSON.stringify({
			model: request.model || this.model,
			messages: request.messages,
			tools: request.tools,
			tool_choice: request.tool_choice,
			max_tokens: request.max_tokens,
			temperature: request.temperature,
			stream: request.stream
		});
	}

	private async doFetch(body: string): Promise<Response> {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), this.timeout);

		try {
			const response = await fetch(`${this.baseURL}/chat/completions`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${this.apiKey}`
				},
				body,
				signal: controller.signal
			});
			return response;
		} finally {
			clearTimeout(timer);
		}
	}

	private parseResponse(json: Record<string, unknown>): ChatResponse {
		const choice = (json.choices as Array<Record<string, unknown>>)?.[0];
		if (!choice) {
			throw new ProviderError('No choices in response', 0, json);
		}

		const message = choice.message as Record<string, unknown> | undefined;
		const usage = json.usage as Record<string, unknown> | undefined;

		return {
			content: (message?.content as string) || null,
			reasoning_content: message?.reasoning_content as string | undefined,
			tool_calls: (message?.tool_calls as ToolCall[]) || [],
			finish_reason: (choice.finish_reason as string) || 'stop',
			usage: usage ? parseUsage(usage) : undefined,
			model: (json.model as string) || this.model
		};
	}
}
