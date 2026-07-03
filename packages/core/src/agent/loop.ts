import type { AIProvider, Message, Tool, ToolCall, Usage, ContentPart } from '../ai/index.js';
import { sleep } from '../ai/index.js';
import type { Storage } from '../storage/index.js';
import type { ToolRegistry } from '../tool/index.js';
import { PendingConfirmation } from '../tool/index.js';
import { ToolContext } from '../tool/index.js';
import type { AgentEvent, BuildResult, ConfirmFn, LoopHooks } from './types.js';
import { AgentState } from './types.js';
import { pendingSteering } from '../chat-steering.js';
import { sanitizeMessages } from './message-sanitizer.js';

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
const COMPRESSION_THRESHOLD_DEFAULT = 256_000;

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
	private fullReasoning = '';
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

	// ── Tool context ──
	private toolContext: ToolContext;

	// ── Compression ──
	private compressionMode: 'auto' | 'custom';
	private compressionThreshold: number;

	constructor(
		provider: AIProvider,
		storage: Storage,
		registry: ToolRegistry,
		onConfirm: ConfirmFn,
		signal?: AbortSignal,
		hooks: LoopHooks = {},
		compressionMode: 'auto' | 'custom' = 'auto',
		compressionThreshold: number = COMPRESSION_THRESHOLD_DEFAULT
	) {
		this.provider = provider;
		this.storage = storage;
		this.registry = registry;
		this.onConfirm = onConfirm;
		this.signal = signal;
		this.hooks = hooks;
		this.toolContext = new ToolContext(process.cwd());
		this.compressionMode = compressionMode;
		this.compressionThreshold = compressionThreshold;
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

		const session = await this.storage.getSession(sessionId);
		if (session?.workspace) {
			this.toolContext = new ToolContext(session.workspace);
		}

		pendingSteering.delete(sessionId);

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
					case AgentState.DONE:
					case AgentState.ERROR:
						break;
				}
			}
		} catch (error) {
			yield { type: 'error', message: (error as Error).message || '未知错误' };
		}
	}

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
		this.fullReasoning = '';
		this.collectedToolCalls.clear();
		this.chunkUsage = undefined;
		this.attempt = 0;

		yield* this.consumeSteering();

		const modified = await this.hooks.beforeLlmCall?.(this.messages);
		if (modified) this.messages = modified;

		this.state = AgentState.LLM_STREAMING;
	}

	private async *consumeSteering(): AsyncGenerator<AgentEvent> {
		const steering = pendingSteering.get(this.effectiveSessionId);
		if (!steering || steering.length === 0) return;

		const drained = steering.splice(0);
		for (const s of drained) {
			await this.storage.addMessage(this.effectiveSessionId, {
				session_id: this.effectiveSessionId,
				role: 'user',
				content: s.text
			});
			this.messages.push({ role: 'user', content: s.text });
			yield { type: 'steering_consumed', messageId: s.messageId };
		}
	}

	private async *doLlmStreaming(): AsyncGenerator<AgentEvent> {
		try {
			const apiMessages = sanitizeMessages(this.messages);
			const stream = this.provider.chatStream({
				messages: apiMessages,
				tools: this.tools.length > 0 ? this.tools : undefined
			});

			for await (const chunk of stream) {
			if (chunk.reasoning_content) {
				this.fullReasoning += chunk.reasoning_content;
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
		if (this.chunkUsage) {
			const cu = this.chunkUsage;
			this.totalUsage = this.totalUsage
				? {
						prompt_tokens: (this.totalUsage.prompt_tokens || 0) + (cu.prompt_tokens || 0),
						completion_tokens: (this.totalUsage.completion_tokens || 0) + (cu.completion_tokens || 0),
						total_tokens: (this.totalUsage.total_tokens || 0) + (cu.total_tokens || 0)
					}
				: { ...cu };
		}

		await this.hooks.afterLlmCall?.(this.totalUsage);

		this.resolvedToolCalls = Array.from(this.collectedToolCalls.values());

		if (this.resolvedToolCalls.length === 0) {
			await this.storage.addMessage(this.effectiveSessionId, {
				session_id: this.effectiveSessionId,
				role: 'assistant',
				content: this.fullContent,
				reasoning_content: this.fullReasoning || undefined,
				usage: this.totalUsage
			});

			if (this.totalUsage) {
				await this.storage.updateTokenCount(this.effectiveSessionId, this.totalUsage.total_tokens);
			}

			yield* this.tryForkIfWindowLow();

			yield { type: 'done', messageId: crypto.randomUUID(), usage: this.totalUsage, contextWindow: this.contextWindow };

			this.state = AgentState.DONE;
			return;
		}

		this.messages.push({
			role: 'assistant',
			content: this.fullContent || '',
			tool_calls: this.resolvedToolCalls,
			reasoning_content: this.fullReasoning || undefined
		});

		yield* this.tryForkIfWindowLow();

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

		const updateQueue: string[] = [];
		let toolDone = false;
		let toolResult: { success: boolean; output: string; error?: string } | undefined;
		let toolError: unknown | undefined;
		let wakeUp: (() => void) | null = null;

		this.toolContext.onUpdate = (chunk) => {
			if (!toolDone) {
				updateQueue.push(chunk);
				wakeUp?.();
			}
		};

		const execPromise = this.registry.execute(name, this.currentArgs, this.toolContext)
			.then((r) => { toolResult = r; })
			.catch((e) => { toolError = e; })
			.finally(() => {
				this.toolContext.onUpdate = undefined;
				toolDone = true;
				wakeUp?.();
			});

		while (!toolDone) {
			if (updateQueue.length > 0) {
				while (updateQueue.length > 0) {
					const chunk = updateQueue.shift()!;
					yield { type: 'tool_execution_update', name, text: chunk };
				}
			} else {
				await new Promise<void>((resolve) => { wakeUp = resolve; });
			}
		}

		if (toolError) {
			if (toolError instanceof PendingConfirmation) {
				this.pendingConfirmation = toolError;
				this.state = AgentState.AWAIT_CONFIRM;
				return;
			}

			const errMsg = (toolError as Error).message;
			yield { type: 'tool_result', name, success: false, output: errMsg };
			this.toolResultMsgs.push({ role: 'tool', content: `工具执行异常: ${errMsg}`, tool_call_id: tc.id, name });
			this.messages.push({ role: 'tool', content: `工具执行异常: ${errMsg}`, tool_call_id: tc.id, name });

			this.state = AgentState.POST_TOOL;
			return;
		}

		const result = toolResult!;
		yield { type: 'tool_result', name, success: result.success, output: result.output };

		const content = result.output || result.error || '';
		this.toolResultMsgs.push({ role: 'tool', content, tool_call_id: tc.id, name });
		this.messages.push({ role: 'tool', content, tool_call_id: tc.id, name });

		await this.hooks.afterToolExecution?.(name, { success: result.success, output: result.output });

		this.state = AgentState.POST_TOOL;
	}

	private async *doAwaitConfirm(): AsyncGenerator<AgentEvent> {
		const error = this.pendingConfirmation!;
		const tc = this.currentToolCall!;
		const confirmId = crypto.randomUUID();

		await this.hooks.onConfirmRequired?.(error, confirmId);

		yield { type: 'confirm_required', confirmId, confirmation: error };

		let abortCleanup: (() => void) | undefined;
		const approved = await Promise.race([
			this.onConfirm(error, confirmId),
			new Promise<boolean>((resolve) => {
				if (this.signal) {
					const onAbort = () => resolve(false);
					this.signal.addEventListener('abort', onAbort, { once: true });
					abortCleanup = () => this.signal?.removeEventListener('abort', onAbort);
				}
			})
		]);
		abortCleanup?.();

		if (approved) {
			try {
			const retryResult = await this.registry.execute(
				error.toolName,
				{ ...error.args, __confirmed: true },
				this.toolContext
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
			reasoning_content: this.fullReasoning || undefined,
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

	private async *tryForkIfWindowLow(): AsyncGenerator<AgentEvent> {
		const tokensUsed = this.totalUsage?.total_tokens || 0;
		if (tokensUsed <= 0) return;

		const shouldFork = this.compressionMode === 'custom'
			? tokensUsed > this.compressionThreshold
			: this.contextWindow - tokensUsed < CONTINUE_THRESHOLD;

		if (shouldFork) {
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
	}

	private extractPriorCompression(messages: Message[]): string | undefined {
		const systemMsg = messages.find((m) => m.role === 'system');
		if (!systemMsg) return undefined;
		const content = extractTextContent(systemMsg.content);
		const marker = '[此对话延续自';
		const idx = content.indexOf(marker);
		if (idx === -1) return undefined;
		return content.slice(idx);
	}

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

						let compression = '';
			const priorCompression = this.extractPriorCompression(allMessages);
			try {
				let prompt = `The following is a conversation history that needs compression due to context length. Extract the **key information needed to continue the current task**, output in Chinese using the format below:

## 目标
- Core task the user wants to accomplish (1 sentence)

## 进度
- 已完成: <completed items>
- 进行中: <in progress>
- 阻塞: <blocked items, omit if none>

## 关键决策
- <key technical decisions, tool choices, approaches taken>

## 用户偏好与约束
- <user habits, preferences, explicit constraints>

## 关键上下文
- <file paths, key parameters, environment info>

## 下一步
- <next steps, ordered by priority>

Conversation:
${rawContent}`;

				if (priorCompression) {
					prompt += `\n\nBelow is an existing compression summary. Update it by preserving ALL existing information and adding new developments:\n${priorCompression}`;
				}

				const res = await this.provider.chat({
					messages: [{ role: 'user', content: prompt }],
					max_tokens: 2000,
					temperature: 0.3
				});
				compression = res.content || '';
			} catch {
				compression = rawContent.slice(0, 2000);
			}

			if (!compression) return null;

			const newTitle = `[延续] ${parentSession.title}`;
			const newSession = await this.storage.createSession(newTitle, parentSession.memory_snapshot, parentSession.workspace);

			await this.storage.addMessage(newSession.id, {
				session_id: newSession.id,
				role: 'system',
				content: `[此对话延续自会话「${parentSession.title || sessionId}」，以下为上下文压缩]\n\n${compression}`
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
					reasoning_content: msg.reasoning_content,
					tool_calls: msg.tool_calls,
					tool_call_id: msg.tool_call_id,
					name: msg.name,
					usage: msg.usage
				});
			}


			return newSession.id;
		} catch {
			return null;
		}
	}
}
