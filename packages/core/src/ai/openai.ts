import type { AIProvider } from './base.js';
import type { ChatRequest, ChatResponse, ToolCall, Usage } from './types.js';
import { fetchWithRetry, parseSSEStream, ProviderError, parseUsage } from './utils.js';

/**
 * OpenAIProvider 初始化参数
 */
export interface OpenAIConfig {
	/** API 密钥 */
	apiKey: string;
	/** API 基础地址，例如 https://api.openai.com/v1 */
	baseURL: string;
	/** 默认模型名称 */
	model: string;
	/** 请求超时（毫秒），默认 60000 */
	timeout?: number;
	/** 最大重试次数，默认 2 */
	maxRetries?: number;
}

/**
 * OpenAI 兼容格式的 AI 供应商实现
 *
 * 封装 fetch 调用 /v1/chat/completions 端点，支持：
 * - 非流式调用（chat）
 * - SSE 流式调用（chatStream）
 * - 自动重试（仅 5xx 错误 + 网络错误，指数退避）
 * - 超时控制（AbortController）
 * - usage / reasoning_content 透传
 */
export class OpenAIProvider implements AIProvider {
	private apiKey: string;
	private baseURL: string;
	protected model: string;
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

	async *chatStream(request: ChatRequest): AsyncGenerator<import('./types').StreamChunk> {
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

	protected buildBodyObject(request: ChatRequest & { stream: boolean }): Record<string, unknown> {
		return {
			model: request.model || this.model,
			messages: request.messages,
			tools: request.tools,
			tool_choice: request.tool_choice,
			max_tokens: request.max_tokens,
			temperature: request.temperature,
			stream: request.stream
		};
	}

	protected buildBody(request: ChatRequest & { stream: boolean }): string {
		return JSON.stringify(this.buildBodyObject(request));
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
