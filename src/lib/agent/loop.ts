import type { AIProvider, Message, ToolCall, Usage } from '$lib/provider';
import { sleep } from '$lib/provider';
import type { Storage } from '$lib/storage';
import type { ToolRegistry } from '$lib/tool';
import { PendingConfirmation } from '$lib/tool';
import type { AgentEvent, BuildResult, ConfirmFn } from './types';

const MAX_LLM_RETRIES = 5;
const RETRY_BASE_DELAY = 1000;

/**
 * AgentLoop — Agent 主循环
 *
 * AsyncGenerator 形式的对话主循环，流程：
 * 1. 保存用户消息到 Storage
 * 2. 调用 LLM (chatStream)，内置重试（最多 5 次，指数退避）
 * 3. 流式 yield 'content' 事件
 * 4. 如 LLM 返回 tool_calls：
 *    - 执行工具
 *    - 遇 PendingConfirmation 则 yield 'confirm_required' 并 await onConfirm
 *    - yield 'tool_result'
 *    - 结果拼入 messages 继续循环
 * 5. 无 tool_calls 时保存 assistant 消息，yield 'done' 结束
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
		const effectiveSessionId = buildResult.forked?.newSessionId || sessionId;

		if (buildResult.forked) {
			yield {
				type: 'forked',
				newSessionId: buildResult.forked.newSessionId,
				summary: buildResult.forked.summary
			};
		}

		await this.storage.addMessage(effectiveSessionId, {
			id: userMessageId,
			session_id: effectiveSessionId,
			role: 'user',
			content: userMessage
		});

		const messages: Message[] = [...buildResult.messages];
		const tools = this.registry.getDefinitions();
		let totalUsage: Usage | undefined;

		try {
			while (true) {
				if (this.signal?.aborted) {
					break;
				}

				let fullContent = '';
				let collectedToolCalls: Map<number, ToolCall> = new Map();
				let chunkUsage: Usage | undefined;

				// === LLM 调用（含重试） ===
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

						break; // LLM 调用成功
					} catch (llmError) {
						// 重置当前轮的部分状态
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
					const assistantMsg = await this.storage.addMessage(effectiveSessionId, {
						session_id: effectiveSessionId,
						role: 'assistant',
						content: fullContent,
						usage: totalUsage
					});

					if (totalUsage) {
						await this.storage.updateTokenCount(effectiveSessionId, totalUsage.total_tokens);
					}

					yield { type: 'done', messageId: assistantMsg.id, usage: totalUsage };
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

				// Persist assistant + all tool results atomically after all tools complete
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
		} catch (error) {
			yield { type: 'error', message: (error as Error).message || '未知错误' };
		}
	}
}
