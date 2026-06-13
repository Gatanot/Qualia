import type { AIProvider, Message, Tool, ToolCall, Usage, ContentPart } from '$lib/provider';
import { sleep } from '$lib/provider';
import type { Storage } from '$lib/storage';
import type { ToolRegistry } from '$lib/tool';
import { PendingConfirmation } from '$lib/tool';
import type { AgentEvent, BuildResult, ConfirmFn, LoopHooks } from './types';
import { AgentState } from './types';

function extractTextContent(content: string | ContentPart[]): string {
	if (typeof content === 'string') return content;
	return content
		.filter((p) => p.type === 'text' && 'text' in p)
		.map((p) => (p as { type: 'text'; text: string }).text)
		.join('\n');
}

const MAX_LLM_RETRIES = 5;
const RETRY_BASE_DELAY = 1000;
const CONTEXT_WINDOW_DEFAULT = 1_048_576;
const CONTINUE_THRESHOLD = 20_000;
const MAX_TOOL_ITERATIONS = 50;

function buildSummaryContent(messages: Message[], initialSystem: string | undefined): string {
	const relevant = messages
		.filter((m) => m.role !== 'system')
		.filter((m) => m.role !== 'tool');

	let header = '';
	if (initialSystem) {
		const short = initialSystem.slice(0, 200);
		header = `原始系统提示词摘要: ${short}\n\n`;
	}

	const lines: string[] = [];
	for (const m of relevant) {
		const role = m.role === 'user' ? '用户' : 'AI';
		const text = extractTextContent(m.content);
		lines.push(`[${role}] ${text.slice(0, 2000)}`);
	}

	return header + lines.join('\n');
}

export class AgentLoop {
	private provider: AIProvider;
	private storage: Storage;
	private registry: ToolRegistry;
	private onConfirm: ConfirmFn;
	private signal?: AbortSignal;
	private hooks: LoopHooks;

	// ── FSM state ──
	private state: AgentState = AgentState.INIT;

	// ── Session context ──
	private effectiveSessionId = '';
	private contextWindow = CONTEXT_WINDOW_DEFAULT;
	private buildResult!: BuildResult;
	private userMsg!: { id: string; content: string; seq: number };
	private messages: Message[] = [];
	private tools: Tool[] = [];
	private totalUsage?: Usage;

	// ── Per-iteration state ──
	private iteration = 0;
	private fullContent = '';
	private collectedToolCalls: Map<number, ToolCall> = new Map();
	private chunkUsage?: Usage;

	// ── Retry state ──
	private attempt = 0;

	// ── Tool execution state ──
	private resolvedToolCalls: ToolCall[] = [];
	private toolIndex = 0;
	private toolResultMsgs: Array<{ role: 'tool'; content: string; tool_call_id: string; name: string }> = [];

	// ── Pending confirmation ──
	private currentToolCall?: ToolCall;
	private currentArgs: Record<string, unknown> = {};
	private pendingConfirmation?: PendingConfirmation;

	constructor(
		provider: AIProvider,
		storage: Storage,
		registry: ToolRegistry,
		onConfirm: ConfirmFn,
		signal?: AbortSignal,
		hooks: LoopHooks = {}
	) {
		this.provider = provider;
		this.storage = storage;
		this.registry = registry;
		this.onConfirm = onConfirm;
		this.signal = signal;
		this.hooks = hooks;
	}

	async *run(
		sessionId: string,
		userMessage: string,
		buildResult: BuildResult,
		userMessageId?: string
	): AsyncGenerator<AgentEvent> {
		this.effectiveSessionId = sessionId;
		this.contextWindow = buildResult.contextWindow || CONTEXT_WINDOW_DEFAULT;
		this.buildResult = buildResult;
		this.messages = [...buildResult.messages];
		this.tools = this.registry.getDefinitions();
		this.totalUsage = undefined;
		this.iteration = 0;
		this.state = AgentState.INIT;

		try {
			while (true) {
				if ((this.state as AgentState) === AgentState.DONE || (this.state as AgentState) === AgentState.ERROR) break;

				switch (this.state as AgentState) {
					case AgentState.INIT:
						yield* this.doInit(userMessage, userMessageId);
						break;
					case AgentState.PRE_LLM:
						yield* this.doPreLlm();
						break;
					case AgentState.LLM_STREAMING:
						yield* this.doLlmStreaming();
						break;
					case AgentState.POST_LLM:
						yield* this.doPostLlm();
						break;
					case AgentState.LLM_RETRY_WAIT:
						yield* this.doLlmRetryWait();
						break;
					case AgentState.PRE_TOOL:
						yield* this.doPreTool();
						break;
					case AgentState.TOOL_EXECUTING:
						yield* this.doToolExecuting();
						break;
					case AgentState.AWAIT_CONFIRM:
						yield* this.doAwaitConfirm();
						break;
					case AgentState.POST_TOOL:
						yield* this.doPostTool();
						break;
					case AgentState.PERSIST_TURN:
						yield* this.doPersistTurn();
						break;
					case AgentState.CHECK_CONTINUE:
						yield* this.doCheckContinue();
						break;
				}
			}
		} catch (error) {
			yield { type: 'error', message: (error as Error).message || '未知错误' };
		}
	}

	// ═══════════════════════════════════════════════════════
	//  State handlers
	// ═══════════════════════════════════════════════════════

	private async *doInit(userMessage: string, userMessageId?: string): AsyncGenerator<AgentEvent> {
		this.userMsg = await this.storage.addMessage(this.effectiveSessionId, {
			id: userMessageId,
			session_id: this.effectiveSessionId,
			role: 'user',
			content: userMessage
		});
		this.state = AgentState.PRE_LLM;
	}

	private async *doPreLlm(): AsyncGenerator<AgentEvent> {
		if (this.signal?.aborted) {
			this.state = AgentState.DONE;
			return;
		}

		if (this.iteration >= MAX_TOOL_ITERATIONS) {
			yield { type: 'error', message: `达到最大工具调用次数限制（${MAX_TOOL_ITERATIONS}次），请简化任务后重试` };
			this.state = AgentState.ERROR;
			return;
		}

		this.fullContent = '';
		this.collectedToolCalls.clear();
		this.chunkUsage = undefined;
		this.attempt = 0;

		await this.hooks.beforeLlmCall?.(this.messages);

		this.state = AgentState.LLM_STREAMING;
	}

	private async *doLlmStreaming(): AsyncGenerator<AgentEvent> {
		try {
			const stream = this.provider.chatStream({
				messages: this.messages,
				tools: this.tools.length > 0 ? this.tools : undefined
			});

			for await (const chunk of stream) {
				if (chunk.reasoning_content) {
					yield { type: 'reasoning', text: chunk.reasoning_content };
				}

				if (chunk.content) {
					this.fullContent += chunk.content;
					yield { type: 'content', text: chunk.content };
				}

				if (chunk.tool_calls) {
					for (const tc of chunk.tool_calls) {
						const existing = this.collectedToolCalls.get(tc.index);
						if (existing) {
							if (tc.function?.arguments) {
								existing.function.arguments += tc.function.arguments;
							}
						} else if (tc.id) {
							const newTc: ToolCall = {
								id: tc.id,
								type: 'function',
								function: {
									name: tc.function?.name || '',
									arguments: tc.function?.arguments || ''
								}
							};
							this.collectedToolCalls.set(tc.index, newTc);
						}
					}
				}

				if (chunk.usage) this.chunkUsage = chunk.usage;
			}

			this.state = AgentState.POST_LLM;
		} catch (llmError) {
			this.fullContent = '';
			this.collectedToolCalls.clear();
			this.chunkUsage = undefined;

			if (this.attempt >= MAX_LLM_RETRIES) {
				const errorMessage = `[连接失败] ${(llmError as Error).message || '多次重试后仍无法连接'}`;
				await this.storage.addMessage(this.effectiveSessionId, {
					session_id: this.effectiveSessionId,
					role: 'assistant',
					content: errorMessage
				});
				yield {
					type: 'retry_exhausted',
					message: (llmError as Error).message || '连接失败',
					partialContent: true
				};
				this.state = AgentState.ERROR;
				return;
			}

			this.state = AgentState.LLM_RETRY_WAIT;
		}
	}

	private async *doLlmRetryWait(): AsyncGenerator<AgentEvent> {
		await this.hooks.onLlmRetry?.(this.attempt + 1, MAX_LLM_RETRIES, new Error('LLM call failed'));
		yield { type: 'retrying', attempt: this.attempt + 1, maxRetries: MAX_LLM_RETRIES };
		await sleep(RETRY_BASE_DELAY * Math.pow(2, this.attempt));
		this.attempt++;
		this.state = AgentState.LLM_STREAMING;
	}

	private async *doPostLlm(): AsyncGenerator<AgentEvent> {
		if (this.chunkUsage) this.totalUsage = this.chunkUsage;

		await this.hooks.afterLlmCall?.(this.totalUsage);

		this.resolvedToolCalls = Array.from(this.collectedToolCalls.values());

		if (this.resolvedToolCalls.length === 0) {
			await this.storage.addMessage(this.effectiveSessionId, {
				session_id: this.effectiveSessionId,
				role: 'assistant',
				content: this.fullContent,
				usage: this.totalUsage
			});

			if (this.totalUsage) {
				await this.storage.updateTokenCount(this.effectiveSessionId, this.totalUsage.total_tokens);
			}

			yield { type: 'done', messageId: crypto.randomUUID(), usage: this.totalUsage, contextWindow: this.contextWindow };

			this.state = AgentState.CHECK_CONTINUE;
			return;
		}

		this.messages.push({
			role: 'assistant',
			content: this.fullContent || '',
			tool_calls: this.resolvedToolCalls
		});

		this.toolResultMsgs = [];
		this.toolIndex = 0;
		this.state = AgentState.PRE_TOOL;
	}

	private async *doPreTool(): AsyncGenerator<AgentEvent> {
		if (this.signal?.aborted) {
			this.state = AgentState.DONE;
			return;
		}

		if (this.toolIndex >= this.resolvedToolCalls.length) {
			this.state = AgentState.PERSIST_TURN;
			return;
		}

		this.currentToolCall = this.resolvedToolCalls[this.toolIndex];

		this.currentArgs = {};
		try { this.currentArgs = JSON.parse(this.currentToolCall.function.arguments); } catch { /* empty */ }

		const modifiedArgs = await this.hooks.beforeToolExecution?.(this.currentToolCall.function.name, this.currentArgs);
		if (modifiedArgs) this.currentArgs = modifiedArgs;

		yield { type: 'tool_call', name: this.currentToolCall.function.name, args: this.currentArgs };

		this.state = AgentState.TOOL_EXECUTING;
	}

	private async *doToolExecuting(): AsyncGenerator<AgentEvent> {
		const tc = this.currentToolCall!;
		const name = tc.function.name;

		try {
			const result = await this.registry.execute(name, this.currentArgs, process.cwd());

			yield { type: 'tool_result', name, success: result.success, output: result.output };

			const content = result.output || result.error || '';
			this.toolResultMsgs.push({ role: 'tool', content, tool_call_id: tc.id, name });
			this.messages.push({ role: 'tool', content, tool_call_id: tc.id, name });

			await this.hooks.afterToolExecution?.(name, { success: result.success, output: result.output });

			this.state = AgentState.POST_TOOL;
		} catch (error) {
			if (error instanceof PendingConfirmation) {
				this.pendingConfirmation = error;
				this.state = AgentState.AWAIT_CONFIRM;
				return;
			}

			const errMsg = (error as Error).message;
			yield { type: 'tool_result', name, success: false, output: errMsg };
			this.toolResultMsgs.push({ role: 'tool', content: `工具执行异常: ${errMsg}`, tool_call_id: tc.id, name });
			this.messages.push({ role: 'tool', content: `工具执行异常: ${errMsg}`, tool_call_id: tc.id, name });

			this.state = AgentState.POST_TOOL;
		}
	}

	private async *doAwaitConfirm(): AsyncGenerator<AgentEvent> {
		const error = this.pendingConfirmation!;
		const tc = this.currentToolCall!;
		const confirmId = crypto.randomUUID();

		await this.hooks.onConfirmRequired?.(error, confirmId);

		yield { type: 'confirm_required', confirmId, confirmation: error };

		const approved = await Promise.race([
			this.onConfirm(error, confirmId),
			new Promise<boolean>((resolve) => {
				if (this.signal) {
					const onAbort = () => resolve(false);
					this.signal.addEventListener('abort', onAbort, { once: true });
				}
			})
		]);

		if (approved) {
			try {
				const retryResult = await this.registry.execute(
					error.toolName,
					{ ...error.args, __confirmed: true },
					process.cwd()
				);
				yield { type: 'tool_result', name: error.toolName, success: retryResult.success, output: retryResult.output };
				const content = retryResult.output || retryResult.error || '';
				this.toolResultMsgs.push({ role: 'tool', content, tool_call_id: tc.id, name: error.toolName });
				this.messages.push({ role: 'tool', content, tool_call_id: tc.id, name: error.toolName });
			} catch (retryError) {
				const errMsg = (retryError as Error).message;
				yield { type: 'tool_result', name: error.toolName, success: false, output: errMsg };
				this.toolResultMsgs.push({ role: 'tool', content: `执行失败: ${errMsg}`, tool_call_id: tc.id, name: error.toolName });
				this.messages.push({ role: 'tool', content: `执行失败: ${errMsg}`, tool_call_id: tc.id, name: error.toolName });
			}
		} else {
			const cancelMsg = '用户取消了此操作';
			yield { type: 'tool_result', name: error.toolName, success: false, output: cancelMsg };
			this.toolResultMsgs.push({ role: 'tool', content: cancelMsg, tool_call_id: tc.id, name: error.toolName });
			this.messages.push({ role: 'tool', content: cancelMsg, tool_call_id: tc.id, name: error.toolName });
		}

		this.pendingConfirmation = undefined;
		this.state = AgentState.POST_TOOL;
	}

	private async *doPostTool(): AsyncGenerator<AgentEvent> {
		this.toolIndex++;
		this.state = AgentState.PRE_TOOL;
	}

	private async *doPersistTurn(): AsyncGenerator<AgentEvent> {
		await this.hooks.afterTurn?.(this.iteration);

		await this.storage.addMessage(this.effectiveSessionId, {
			session_id: this.effectiveSessionId,
			role: 'assistant',
			content: this.fullContent || '',
			tool_calls: this.resolvedToolCalls,
			usage: this.totalUsage
		});

		if (this.totalUsage) {
			await this.storage.updateTokenCount(this.effectiveSessionId, this.totalUsage.total_tokens);
		}

		for (const t of this.toolResultMsgs) {
			await this.storage.addMessage(this.effectiveSessionId, {
				session_id: this.effectiveSessionId,
				role: 'tool',
				content: t.content,
				tool_call_id: t.tool_call_id,
				name: t.name
			});
		}

		if (this.signal?.aborted) {
			this.state = AgentState.DONE;
			return;
		}

		this.iteration++;
		this.state = AgentState.PRE_LLM;
	}

	private async *doCheckContinue(): AsyncGenerator<AgentEvent> {
		const tokensUsed = this.totalUsage?.total_tokens || 0;
		if (tokensUsed > 0 && this.contextWindow - tokensUsed < CONTINUE_THRESHOLD) {
			const newId = await this.createContinuation(
				this.effectiveSessionId,
				this.userMsg,
				this.messages,
				typeof this.buildResult.messages[0]?.content === 'string' ? this.buildResult.messages[0]?.content : undefined
			);
			if (newId) {
				yield { type: 'forked', newSessionId: newId };
			}
		}
		this.state = AgentState.DONE;
	}

	// ═══════════════════════════════════════════════════════
	//  createContinuation
	// ═══════════════════════════════════════════════════════

	private async createContinuation(
		sessionId: string,
		userMsg: { id: string; content: string; seq: number },
		allMessages: Message[],
		systemPrompt?: string
	): Promise<string | null> {
		try {
			const parentSession = await this.storage.getSession(sessionId);
			if (!parentSession) return null;

			const rawContent = buildSummaryContent(allMessages, systemPrompt);

			let summary = '';
			try {
				const res = await this.provider.chat({
					messages: [
						{ role: 'user', content: `请用中文简洁总结以下对话的关键内容（决策、修改、结论、用户偏好），用于延续对话时提供上下文。不超过 500 字，以要点形式呈现。\n\n对话内容：\n${rawContent}` }
					],
					max_tokens: 2000,
					temperature: 0.3
				});
				summary = res.content || '';
			} catch {
				summary = rawContent.slice(0, 2000);
			}

			if (!summary) return null;

			const newTitle = `[延续] ${parentSession.title}`;
			const newSession = await this.storage.createSession(newTitle, parentSession.memory_snapshot);

			await this.storage.addMessage(newSession.id, {
				session_id: newSession.id,
				role: 'system',
				content: `[此对话延续自会话「${parentSession.title || sessionId}」，以下为之前对话的摘要]\n\n${summary}`
			});

			await this.storage.addMessage(newSession.id, {
				session_id: newSession.id,
				role: 'user',
				content: userMsg.content
			});

			const recentMessages = await this.storage.getMessagesSinceSeq(sessionId, userMsg.seq);
			for (const msg of recentMessages) {
				await this.storage.addMessage(newSession.id, {
					session_id: newSession.id,
					role: msg.role,
					content: msg.content,
					tool_calls: msg.tool_calls,
					tool_call_id: msg.tool_call_id,
					name: msg.name,
					usage: msg.usage
				});
			}

			await this.storage.updateSummary(sessionId, summary);

			return newSession.id;
		} catch {
			return null;
		}
	}
}
