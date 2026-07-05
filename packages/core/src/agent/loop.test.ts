import { describe, it, expect } from 'vitest';
import { AgentLoop } from './loop.js';
import type { AIProvider, ChatResponse, StreamChunk, ToolCall, Message, Usage } from '../ai/index.js';
import { ToolRegistry, ToolDef, ToolResult, PendingConfirmation } from '../tool/index.js';
import { MemoryStorage } from '../storage/memory.js';
import type { BuildResult, ConfirmFn } from './types.js';
import { pendingSteering } from '../chat-steering.js';

function mockProvider(opts: {
	streamChunks?: StreamChunk[];
	streamError?: Error;
} = {}): AIProvider {
	const defaults: StreamChunk[] = [
		{ content: 'Hello from LLM', tool_calls: [], finish_reason: 'stop' }
	];
	return {
		async chat(): Promise<ChatResponse> {
			return { content: '', tool_calls: [], finish_reason: 'stop', model: 'test' };
		},
		async *chatStream(): AsyncGenerator<StreamChunk> {
			if (opts.streamError) throw opts.streamError;
			const chunks = opts.streamChunks && opts.streamChunks.length > 0 ? opts.streamChunks : defaults;
			for (const chunk of chunks) yield chunk;
		}
	};
}

function makeToolCall(id: string, name: string, args: Record<string, unknown>): ToolCall {
	return { id, type: 'function', function: { name, arguments: JSON.stringify(args) } };
}

function streamWithToolCalls(calls: ToolCall[]): StreamChunk[] {
	const deltas = calls.map((tc, i) => ({
		index: i, id: tc.id, type: 'function' as const,
		function: { name: tc.function.name, arguments: tc.function.arguments }
	}));
	return [{ content: '', tool_calls: deltas, finish_reason: 'tool_calls' }];
}

async function collect(
	gen: AsyncGenerator<{ type: string;[k: string]: unknown }>
): Promise<{ type: string;[k: string]: unknown }[]> {
	const events: { type: string;[k: string]: unknown }[] = [];
	for await (const e of gen) events.push(e);
	return events;
}

describe('AgentLoop', () => {
	// ── Basic ──

	it('produces content and done events for a simple text response', async () => {
		const storage = new MemoryStorage();
		const session = await storage.createSession('test');
		const loop = new AgentLoop(mockProvider(), storage, new ToolRegistry(), async () => false);
		const events = await collect(loop.run(session.id, 'hello', {
			messages: [{ role: 'system', content: 'sys' }], contextWindow: 128000
		}));
		expect(events.some((e) => e.type === 'content')).toBe(true);
		expect(events.some((e) => e.type === 'done')).toBe(true);
	});

	// ── Tool calls ──

	it('calls a tool and yields tool_call + tool_result events', async () => {
		const storage = new MemoryStorage();
		const registry = new ToolRegistry();
		let executed = false;
		registry.register({
			name: 'echo', description: '', parameters: { type: 'object', properties: {} },
			async execute(): Promise<{ success: boolean; output: string }> {
				executed = true; return { success: true, output: 'ok' };
			}
		});
		const session = await storage.createSession('test');
		const loop = new AgentLoop(
			mockProvider({ streamChunks: streamWithToolCalls([makeToolCall('c1', 'echo', {})]) }),
			storage, registry, async () => false
		);
		const events = await collect(loop.run(session.id, 'hi', {
			messages: [{ role: 'system', content: 'sys' }], contextWindow: 128000
		}));
		expect(events.some((e) => e.type === 'tool_call')).toBe(true);
		expect(events.some((e) => e.type === 'tool_result')).toBe(true);
		expect(executed).toBe(true);
	});

	// ── Audit log ──

	it('writes audit log after tool execution', async () => {
		const storage = new MemoryStorage();
		const registry = new ToolRegistry();
		registry.register({
			name: 'echo', description: '', parameters: { type: 'object', properties: {} },
			async execute(): Promise<{ success: boolean; output: string }> {
				return { success: true, output: 'logged' };
			}
		});
		const session = await storage.createSession('test');
		const loop = new AgentLoop(
			mockProvider({ streamChunks: streamWithToolCalls([makeToolCall('c1', 'echo', {})]) }),
			storage, registry, async () => false
		);
		await collect(loop.run(session.id, 'hi', {
			messages: [{ role: 'system', content: 'sys' }], contextWindow: 128000
		}));
		const logs = await storage.listAuditLogs();
		const ourLogs = logs.filter((l) => l.session_id === session.id && l.tool_name === 'echo');
		expect(ourLogs.length >= 1).toBe(true);
		expect(ourLogs[0].success).toBe(true);
		expect(ourLogs[0].confirmed).toBe(false);
	});

	it('records failed tool in audit log', async () => {
		const storage = new MemoryStorage();
		const registry = new ToolRegistry();
		registry.register({
			name: 'failing', description: '', parameters: { type: 'object', properties: {} },
			async execute(): Promise<{ success: boolean; output: string }> { throw new Error('boom'); }
		});
		const session = await storage.createSession('test');
		const loop = new AgentLoop(
			mockProvider({ streamChunks: streamWithToolCalls([makeToolCall('c1', 'failing', {})]) }),
			storage, registry, async () => false
		);
		await collect(loop.run(session.id, 'hi', {
			messages: [{ role: 'system', content: 'sys' }], contextWindow: 128000
		}));
		const logs = await storage.listAuditLogs();
		const ourLogs = logs.filter((l) => l.session_id === session.id && l.tool_name === 'failing');
		expect(ourLogs.length >= 1).toBe(true);
		expect(ourLogs[0].success).toBe(false);
	});

	// ── Confirmation ──

	it('requests confirmation and handles approval', async () => {
		const storage = new MemoryStorage();
		const registry = new ToolRegistry();
		registry.register({
			name: 'dangerous', description: '', parameters: { type: 'object', properties: {} },
			async execute(args): Promise<{ success: boolean; output: string }> {
				if ((args as Record<string, unknown>).__confirmed) return { success: true, output: 'done' };
				throw new PendingConfirmation('dangerous', args as Record<string, unknown>, 'confirm?');
			}
		});
		const session = await storage.createSession('test');
		const onConfirm: ConfirmFn = async () => true;
		const loop = new AgentLoop(
			mockProvider({ streamChunks: streamWithToolCalls([makeToolCall('c1', 'dangerous', {})]) }),
			storage, registry, onConfirm
		);
		const events = await collect(loop.run(session.id, 'hi', {
			messages: [{ role: 'system', content: 'sys' }], contextWindow: 128000
		}));
		expect(events.some((e) => e.type === 'confirm_required')).toBe(true);
		expect(events.some((e) => e.type === 'tool_result' && (e as unknown as { success: boolean }).success)).toBe(true);
	});

	it('logs denied confirmation in audit log', async () => {
		const storage = new MemoryStorage();
		const registry = new ToolRegistry();
		registry.register({
			name: 'dangerous', description: '', parameters: { type: 'object', properties: {} },
			async execute(args): Promise<{ success: boolean; output: string }> {
				if ((args as Record<string, unknown>).__confirmed) return { success: true, output: 'done' };
				throw new PendingConfirmation('dangerous', args as Record<string, unknown>, 'confirm?');
			}
		});
		const session = await storage.createSession('test');
		const loop = new AgentLoop(
			mockProvider({ streamChunks: streamWithToolCalls([makeToolCall('c1', 'dangerous', {})]) }),
			storage, registry, async () => false
		);
		const events = await collect(loop.run(session.id, 'hi', {
			messages: [{ role: 'system', content: 'sys' }], contextWindow: 128000
		}));
		expect(events.some((e) => e.type === 'confirm_required')).toBe(true);
		const logs = await storage.listAuditLogs();
		const ourLogs = logs.filter((l) => l.session_id === session.id && l.tool_name === 'dangerous' && l.confirmed);
		expect(ourLogs.length >= 1).toBe(true);
		expect(ourLogs[0].success).toBe(false);
	});

	// ── Multi-turn ──

	it('handles tool call followed by LLM response', async () => {
		const storage = new MemoryStorage();
		const registry = new ToolRegistry();
		registry.register({
			name: 'step_a', description: '', parameters: { type: 'object', properties: {} },
			async execute(): Promise<{ success: boolean; output: string }> { return { success: true, output: 'ok' }; }
		});
		const session = await storage.createSession('test');
		const loop = new AgentLoop(
			mockProvider({ streamChunks: streamWithToolCalls([makeToolCall('c1', 'step_a', {})]) }),
			storage, registry, async () => false
		);
		const events = await collect(loop.run(session.id, 'hi', {
			messages: [{ role: 'system', content: 'sys' }], contextWindow: 128000
		}));
		expect(events.some((e) => e.type === 'tool_call')).toBe(true);
		expect(events.some((e) => e.type === 'tool_result')).toBe(true);
	});

	// ── LLM retry ──

	it('retries on LLM stream error and eventually succeeds', async () => {
		let attempts = 0;
		const provider: AIProvider = {
			async chat(): Promise<ChatResponse> { return { content: '', tool_calls: [], finish_reason: 'stop', model: 'test' }; },
			async *chatStream(): AsyncGenerator<StreamChunk> {
				attempts++;
				if (attempts < 3) throw new Error('connection refused');
				yield { content: 'ok', tool_calls: [], finish_reason: 'stop' };
			}
		};
		const storage = new MemoryStorage();
		const session = await storage.createSession('test');
		const loop = new AgentLoop(provider, storage, new ToolRegistry(), async () => false);
		const events = await collect(loop.run(session.id, 'hi', {
			messages: [{ role: 'system', content: 'sys' }], contextWindow: 128000
		}));
		expect(attempts).toBe(3);
		expect(events.some((e) => e.type === 'retrying')).toBe(true);
		expect(events.some((e) => e.type === 'done')).toBe(true);
	});

	it('emits retry_exhausted after max retries', async () => {
		const provider = mockProvider({ streamError: new Error('persistent failure') });
		const storage = new MemoryStorage();
		const session = await storage.createSession('test');
		const loop = new AgentLoop(provider, storage, new ToolRegistry(), async () => false);
		const events = await collect(loop.run(session.id, 'hi', {
			messages: [{ role: 'system', content: 'sys' }], contextWindow: 128000
		}));
		expect(events.some((e) => e.type === 'retry_exhausted')).toBe(true);
	}, 40000);

	// ── MAX_TOOL_ITERATIONS ──

	it('stops after MAX_TOOL_ITERATIONS', async () => {
		const storage = new MemoryStorage();
		const registry = new ToolRegistry();
		registry.register({
			name: 'loop_forever', description: '', parameters: { type: 'object', properties: {} },
			async execute(): Promise<{ success: boolean; output: string }> { return { success: true, output: 'looping' }; }
		});
		const session = await storage.createSession('test');
		const loop = new AgentLoop(
			mockProvider({ streamChunks: streamWithToolCalls([makeToolCall('c1', 'loop_forever', {})]) }),
			storage, registry, async () => false
		);
		const events = await collect(loop.run(session.id, 'hi', {
			messages: [{ role: 'system', content: 'sys' }], contextWindow: 128000
		}));
		const errs = events.filter((e) => e.type === 'error');
		expect(errs.some((e) => (e as unknown as { message: string }).message.includes('最大工具调用次数'))).toBe(true);
	});

	// ── Error handling ──

	it('handles unknown tool gracefully', async () => {
		const storage = new MemoryStorage();
		const registry = new ToolRegistry();
		const session = await storage.createSession('test');
		const loop = new AgentLoop(
			mockProvider({ streamChunks: streamWithToolCalls([makeToolCall('c1', 'nonexistent', {})]) }),
			storage, registry, async () => false
		);
		const events = await collect(loop.run(session.id, 'hi', {
			messages: [{ role: 'system', content: 'sys' }], contextWindow: 128000
		}));
		const results = events.filter((e) => e.type === 'tool_result');
		expect(results.some((r) => (r as { success?: boolean }).success === false)).toBe(true);
	});
});
