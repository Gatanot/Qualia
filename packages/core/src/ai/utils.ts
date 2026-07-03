import type { ToolCallDelta, StreamChunk, Usage } from './types.js';

/**
 * 供应商请求错误
 */
export class ProviderError extends Error {
	constructor(
		message: string,
		/** HTTP 状态码 */
		public status: number,
		/** 响应体 */
		public body: unknown
	) {
		super(message);
		this.name = 'ProviderError';
	}
}

/**
 * 异步延时
 * @param ms - 毫秒
 */
export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 带自动重试的 fetch 封装
 *
 * 仅对 5xx 错误和网络错误进行指数退避重试。
 * 4xx 错误直接抛出 ProviderError，不重试。
 *
 * @param fetchFn - fetch 调用工厂函数
 * @param maxRetries - 最大重试次数
 * @param baseDelayMs - 基础延迟（毫秒），每次重试延迟加倍
 * @returns Response
 * @throws ProviderError
 */
export async function fetchWithRetry(
	fetchFn: () => Promise<Response>,
	maxRetries: number,
	baseDelayMs: number = 1000
): Promise<Response> {
	let lastError: unknown;

	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			const response = await fetchFn();

			if (response.ok) {
				return response;
			}

			if (response.status < 500 || attempt === maxRetries) {
				const body = await response.json().catch(() => null);
				throw new ProviderError(
					`API returned status ${response.status}`,
					response.status,
					body
				);
			}
		} catch (error) {
			if (error instanceof ProviderError) throw error;
			lastError = error;
		}

		if (attempt < maxRetries) {
			await sleep(baseDelayMs * Math.pow(2, attempt));
		}
	}

	throw lastError;
}

/**
 * 解析 SSE (Server-Sent Events) 流为 StreamChunk 异步生成器
 *
 * @param reader - ReadableStream reader
 * @returns AsyncGenerator<StreamChunk>
 */
export async function* parseSSEStream(
	reader: ReadableStreamDefaultReader<Uint8Array>
): AsyncGenerator<StreamChunk> {
	const decoder = new TextDecoder();
	let buffer = '';

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });
			const lines = buffer.split('\n');
			buffer = lines.pop() || '';

			for (const line of lines) {
				const trimmed = line.trim();
				if (!trimmed || !trimmed.startsWith('data:')) continue;

				const data = trimmed.slice(5).trim();
				if (data === '[DONE]') return;

				try {
					const parsed = JSON.parse(data);
					const choice = parsed.choices?.[0];
					if (!choice) continue;

					const delta = choice.delta || {};
					const rawUsage = parsed.usage || choice.usage;
					const chunk: StreamChunk = {
						content: delta.content || '',
						reasoning_content: delta.reasoning_content || '',
						tool_calls: extractToolCalls(delta.tool_calls),
						finish_reason: choice.finish_reason || null,
						usage: rawUsage ? parseUsage(rawUsage as Record<string, unknown>) : undefined
					};

					yield chunk;
				} catch {
					// skip malformed lines
				}
			}
		}
	} finally {
		reader.releaseLock();
	}
}

function extractToolCalls(raw: unknown): ToolCallDelta[] {
	if (!Array.isArray(raw)) return [];
	return raw.map((tc: Record<string, unknown>) => ({
		index: (tc.index as number) ?? 0,
		id: tc.id as string | undefined,
		type: tc.type as 'function' | undefined,
		function: tc.function
			? {
					name: (tc.function as Record<string, unknown>).name as string | undefined,
					arguments: (tc.function as Record<string, unknown>).arguments as string | undefined
				}
			: undefined
	}));
}

/**
 * 将 API 返回的原始 usage 对象解析为类型化的 Usage
 *
 * @param raw - API 响应的 usage 字段
 */
export function parseUsage(raw: Record<string, unknown>): Usage {
	return {
		prompt_tokens: (raw.prompt_tokens as number) ?? 0,
		completion_tokens: (raw.completion_tokens as number) ?? 0,
		total_tokens: (raw.total_tokens as number) ?? 0,
		prompt_cache_hit_tokens: raw.prompt_cache_hit_tokens as number | undefined,
		prompt_cache_miss_tokens: raw.prompt_cache_miss_tokens as number | undefined,
		completion_tokens_details: raw.completion_tokens_details
			? {
					reasoning_tokens: ((raw.completion_tokens_details as Record<string, unknown>).reasoning_tokens as number) ?? 0
				}
			: undefined
	};
}
