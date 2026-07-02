import type { LoopHooks } from './types';
import type { Message, Usage } from '$lib/ai';

interface TurnLog {
	turn: number;
	llmLatencyMs?: number;
	toolCalls: number;
	inputTokens: number;
	outputTokens: number;
	errors: number;
}

export class AgentLogger implements LoopHooks {
	private sessionId: string;
	private turn = 0;
	private llmStart = 0;
	private turnLog: TurnLog | null = null;

	constructor(sessionId: string) {
		this.sessionId = sessionId;
	}

	async beforeLlmCall(messages: Message[]): Promise<Message[]> {
		this.llmStart = Date.now();
		this.turn++;
		this.turnLog = {
			turn: this.turn,
			toolCalls: 0,
			inputTokens: 0,
			outputTokens: 0,
			errors: 0
		};

		const msgCount = messages.length;
		const lastRole = messages.length > 0 ? messages[messages.length - 1].role : 'none';
		console.log(`[agent ${this.sessionId.slice(0, 8)}] turn ${this.turn} LLM call (${msgCount} msgs, last=${lastRole})`);

		return messages;
	}

	async afterLlmCall(usage?: Usage): Promise<void> {
		const latency = Date.now() - this.llmStart;
		if (this.turnLog) {
			this.turnLog.llmLatencyMs = latency;
		}

		if (usage) {
			if (this.turnLog) {
				this.turnLog.inputTokens = usage.prompt_tokens;
				this.turnLog.outputTokens = usage.completion_tokens;
			}
			const cache = usage.prompt_cache_hit_tokens != null
				? ` cache=${usage.prompt_cache_hit_tokens}+${usage.prompt_cache_miss_tokens}`
				: '';
			console.log(`[agent ${this.sessionId.slice(0, 8)}] turn ${this.turn} done — latency=${latency}ms tokens=${usage.total_tokens} (${usage.prompt_tokens}+${usage.completion_tokens})${cache}`);
		} else {
			console.log(`[agent ${this.sessionId.slice(0, 8)}] turn ${this.turn} done — latency=${latency}ms`);
		}
	}

	async onLlmRetry(attempt: number, maxRetries: number, error: Error): Promise<void> {
		console.log(`[agent ${this.sessionId.slice(0, 8)}] turn ${this.turn} retry ${attempt}/${maxRetries}: ${error.message}`);
		if (this.turnLog) this.turnLog.errors++;
	}

	async beforeToolExecution(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
		const preview = JSON.stringify(args).slice(0, 120);
		console.log(`[agent ${this.sessionId.slice(0, 8)}] turn ${this.turn} tool: ${name}(${preview}${JSON.stringify(args).length > 120 ? '...' : ''})`);
		return args;
	}

	async afterToolExecution(name: string, result: { success: boolean; output: string }): Promise<void> {
		const outLen = result.output.length;
		if (this.turnLog) this.turnLog.toolCalls++;
		const status = result.success ? 'OK' : 'FAIL';
		console.log(`[agent ${this.sessionId.slice(0, 8)}] turn ${this.turn} tool ${name} → ${status} (${outLen} chars)`);
	}

	async onConfirmRequired(confirmation: { toolName: string; reason: string }, confirmId: string): Promise<void> {
		console.log(`[agent ${this.sessionId.slice(0, 8)}] turn ${this.turn} confirm: ${confirmation.toolName} — ${confirmation.reason.slice(0, 80)}`);
	}

	async afterTurn(_iteration: number): Promise<void> {
		if (this.turnLog) {
			const t = this.turnLog;
			console.log(`[agent ${this.sessionId.slice(0, 8)}] turn ${this.turn} summary — tools=${t.toolCalls} tokens=${t.inputTokens}+${t.outputTokens} latency=${t.llmLatencyMs}ms errors=${t.errors}`);
		}
	}
}
