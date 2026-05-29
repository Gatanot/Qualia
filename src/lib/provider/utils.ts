import type { ToolCallDelta, StreamChunk, Usage } from './types';

export class ProviderError extends Error {
	constructor(
		message: string,
		public status: number,
		public body: unknown
	) {
		super(message);
		this.name = 'ProviderError';
	}
}

export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

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
					const chunk: StreamChunk = {
						content: delta.content || '',
						reasoning_content: delta.reasoning_content || '',
						tool_calls: extractToolCalls(delta.tool_calls),
						finish_reason: choice.finish_reason || null,
						usage: parsed.usage ? parseUsage(parsed.usage) : undefined
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
