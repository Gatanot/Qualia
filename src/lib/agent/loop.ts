import type { AIProvider, Message, ToolCall, Usage } from '$lib/provider';
import { sleep } from '$lib/provider';
import type { Storage } from '$lib/storage';
import type { ToolRegistry } from '$lib/tool';
import { PendingConfirmation } from '$lib/tool';
import type { AgentEvent, BuildResult, ConfirmFn } from './types';

const MAX_LLM_RETRIES = 5;
const RETRY_BASE_DELAY = 1000;
const CONTEXT_WINDOW_DEFAULT = 1_048_576;
/** 剩余窗口低于此阈值（20K token）时在回复完成后自动创建延续会话 */
const CONTINUE_THRESHOLD = 20_000;
/** 单次 Agent 循环中工具调用的最大迭代次数 */
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
		const text = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
		lines.push(`[${role}] ${text.slice(0, 2000)}`);
	}

	return header + lines.join('\n');
}

/**
 * AgentLoop — Agent 主循环
 *
 * AsyncGenerator 形式的对话主循环，流程：
 * 1. 保存用户消息到 Storage
 * 2. 调用 LLM (chatStream)，内置重试（最多 5 次，指数退避）
 * 3. 流式 yield 'content' / 'reasoning' 事件
 * 4. 如 LLM 返回 tool_calls：执行工具 → yield 'confirm_required' / 'tool_result'
 * 5. 无 tool_calls 时保存 assistant 消息，yield 'done' 结束
 * 6. done 后若剩余上下文 < 20K，自动生成摘要并创建延续会话，yield 'forked'
 */
export class AgentLoop {
	private provider: AIProvider;
	private storage: Storage;
	private registry: ToolRegistry;
	private onConfirm: ConfirmFn;
	private signal?: AbortSignal;

	constructor(
		provider: AIProvider,
		storage: Storage,
		registry: ToolRegistry,
		onConfirm: ConfirmFn,
		signal?: AbortSignal
	) {
		this.provider = provider;
		this.storage = storage;
		this.registry = registry;
		this.onConfirm = onConfirm;
		this.signal = signal;
	}

	async *run(sessionId: string, userMessage: string, buildResult: BuildResult, userMessageId?: string): AsyncGenerator<AgentEvent> {
		const effectiveSessionId = sessionId;
		const contextWindow = buildResult.contextWindow || CONTEXT_WINDOW_DEFAULT;

		const userMsg = await this.storage.addMessage(effectiveSessionId, {
			id: userMessageId,
			session_id: effectiveSessionId,
			role: 'user',
			content: userMessage
		});

		const messages: Message[] = [...buildResult.messages];
		const tools = this.registry.getDefinitions();
		let totalUsage: Usage | undefined;

		try {
			for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
				if (this.signal?.aborted) {
					break;
				}

				let fullContent = '';
				let collectedToolCalls: Map<number, ToolCall> = new Map();
				let chunkUsage: Usage | undefined;

				for (let attempt = 0; attempt <= MAX_LLM_RETRIES; attempt++) {
					try {
						const stream = this.provider.chatStream({
							messages,
							tools: tools.length > 0 ? tools : undefined
						});

						for await (const chunk of stream) {
							if (chunk.reasoning_content) {
								yield { type: 'reasoning', text: chunk.reasoning_content };
							}

							if (chunk.content) {
								fullContent += chunk.content;
								yield { type: 'content', text: chunk.content };
							}

							if (chunk.tool_calls) {
								for (const tc of chunk.tool_calls) {
									const existing = collectedToolCalls.get(tc.index);
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
										collectedToolCalls.set(tc.index, newTc);
									}
								}
							}

							if (chunk.usage) chunkUsage = chunk.usage;
						}

						break;
					} catch (llmError) {
						fullContent = '';
						collectedToolCalls.clear();
						chunkUsage = undefined;

						if (attempt === MAX_LLM_RETRIES) {
							yield {
								type: 'retry_exhausted',
								message: (llmError as Error).message || '连接失败',
								partialContent: true
							};
							return;
						}

						yield { type: 'retrying', attempt: attempt + 1, maxRetries: MAX_LLM_RETRIES };
						await sleep(RETRY_BASE_DELAY * Math.pow(2, attempt));
					}
				}

				if (chunkUsage) totalUsage = chunkUsage;

				const resolvedToolCalls = Array.from(collectedToolCalls.values());

				if (resolvedToolCalls.length === 0) {
					await this.storage.addMessage(effectiveSessionId, {
						session_id: effectiveSessionId,
						role: 'assistant',
						content: fullContent,
						usage: totalUsage
					});

					if (totalUsage) {
						await this.storage.updateTokenCount(effectiveSessionId, totalUsage.total_tokens);
					}

					yield { type: 'done', messageId: crypto.randomUUID(), usage: totalUsage, contextWindow };

					const tokensUsed = totalUsage?.total_tokens || 0;
					if (tokensUsed > 0 && contextWindow - tokensUsed < CONTINUE_THRESHOLD) {
						const newId = await this.createContinuation(
							effectiveSessionId,
							userMsg,
							messages,
							typeof buildResult.messages[0]?.content === 'string' ? buildResult.messages[0]?.content : undefined
						);
						if (newId) {
							yield { type: 'forked', newSessionId: newId };
						}
					}
					return;
				}

				messages.push({
					role: 'assistant',
					content: fullContent || '',
					tool_calls: resolvedToolCalls
				});

				const toolResultMsgs: Array<{ role: 'tool'; content: string; tool_call_id: string; name: string }> = [];

				for (const tc of resolvedToolCalls) {
					if (this.signal?.aborted) {
						break;
					}

					let args: Record<string, unknown> = {};
					try { args = JSON.parse(tc.function.arguments); } catch { /* empty */ }

					yield { type: 'tool_call', name: tc.function.name, args };

					try {
						const result = await this.registry.execute(tc.function.name, args, process.cwd());

						yield { type: 'tool_result', name: tc.function.name, success: result.success, output: result.output };

						const content = result.output || result.error || '';
						toolResultMsgs.push({ role: 'tool', content, tool_call_id: tc.id, name: tc.function.name });
						messages.push({ role: 'tool', content, tool_call_id: tc.id, name: tc.function.name });
					} catch (error) {
						if (error instanceof PendingConfirmation) {
							const confirmId = crypto.randomUUID();
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
									toolResultMsgs.push({ role: 'tool', content, tool_call_id: tc.id, name: error.toolName });
									messages.push({ role: 'tool', content, tool_call_id: tc.id, name: error.toolName });
								} catch (retryError) {
									const errMsg = (retryError as Error).message;
									yield { type: 'tool_result', name: error.toolName, success: false, output: errMsg };
									toolResultMsgs.push({ role: 'tool', content: `执行失败: ${errMsg}`, tool_call_id: tc.id, name: error.toolName });
									messages.push({ role: 'tool', content: `执行失败: ${errMsg}`, tool_call_id: tc.id, name: error.toolName });
								}
							} else {
								const cancelMsg = '用户取消了此操作';
								yield { type: 'tool_result', name: error.toolName, success: false, output: cancelMsg };
								toolResultMsgs.push({ role: 'tool', content: cancelMsg, tool_call_id: tc.id, name: error.toolName });
								messages.push({ role: 'tool', content: cancelMsg, tool_call_id: tc.id, name: error.toolName });
							}
						} else {
							const errMsg = (error as Error).message;
							yield { type: 'tool_result', name: tc.function.name, success: false, output: errMsg };
							toolResultMsgs.push({ role: 'tool', content: `工具执行异常: ${errMsg}`, tool_call_id: tc.id, name: tc.function.name });
							messages.push({ role: 'tool', content: `工具执行异常: ${errMsg}`, tool_call_id: tc.id, name: tc.function.name });
						}
					}
				}

				if (this.signal?.aborted) {
					break;
				}

				await this.storage.addMessage(effectiveSessionId, {
					session_id: effectiveSessionId,
					role: 'assistant',
					content: fullContent || '',
					tool_calls: resolvedToolCalls,
					usage: totalUsage
				});

				if (totalUsage) {
					await this.storage.updateTokenCount(effectiveSessionId, totalUsage.total_tokens);
				}

				for (const t of toolResultMsgs) {
					await this.storage.addMessage(effectiveSessionId, {
						session_id: effectiveSessionId,
						role: 'tool',
						content: t.content,
						tool_call_id: t.tool_call_id,
						name: t.name
					});
				}
			}

			yield { type: 'error', message: `达到最大工具调用次数限制（${MAX_TOOL_ITERATIONS}次），请简化任务后重试` };
		} catch (error) {
			yield { type: 'error', message: (error as Error).message || '未知错误' };
		}
	}

	/**
	 * 创建延续会话
	 *
	 * 为当前会话生成摘要，新建子会话并在首条 system 消息中注入摘要上下文。
	 * 同时将本轮用户消息及回复后的增量消息复制到新会话，保持展示连续性。
	 */
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
