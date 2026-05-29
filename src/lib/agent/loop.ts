import type { AIProvider, Message, ToolCall, Usage } from '$lib/provider';
import type { Storage } from '$lib/storage';
import type { ToolRegistry } from '$lib/tool';
import { PendingConfirmation } from '$lib/tool';
import type { AgentEvent, BuildResult, ConfirmFn } from './types';

export class AgentLoop {
	private provider: AIProvider;
	private storage: Storage;
	private registry: ToolRegistry;
	private onConfirm: ConfirmFn;

	constructor(
		provider: AIProvider,
		storage: Storage,
		registry: ToolRegistry,
		onConfirm: ConfirmFn
	) {
		this.provider = provider;
		this.storage = storage;
		this.registry = registry;
		this.onConfirm = onConfirm;
	}

	async *run(sessionId: string, userMessage: string, buildResult: BuildResult): AsyncGenerator<AgentEvent> {
		const effectiveSessionId = buildResult.forked?.newSessionId || sessionId;

		// Notify fork
		if (buildResult.forked) {
			yield {
				type: 'forked',
				newSessionId: buildResult.forked.newSessionId,
				summary: buildResult.forked.summary
			};
		}

		// Save user message
		await this.storage.addMessage(effectiveSessionId, {
			session_id: effectiveSessionId,
			role: 'user',
			content: userMessage
		});

		// Track session for title update
		const session = await this.storage.getSession(effectiveSessionId);
		if (session && !session.title) {
			const title = userMessage.slice(0, 30).replace(/\n/g, ' ');
			const s = await this.storage.getSession(effectiveSessionId);
			if (s) {
				await this.storage.updateTokenCount(effectiveSessionId, s.token_count);
			}
		}

		// Main agent loop
		const messages: Message[] = [...buildResult.messages];
		const tools = this.registry.getDefinitions();
		let totalUsage: Usage | undefined;

		try {
			while (true) {
				// Call LLM
				let fullContent = '';
				let collectedToolCalls: Map<number, ToolCall> = new Map();
				let finishReason: string | null = null;
				let chunkUsage: Usage | undefined;

				const stream = this.provider.chatStream({
					messages,
					tools: tools.length > 0 ? tools : undefined
				});

				for await (const chunk of stream) {
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

					if (chunk.finish_reason) {
						finishReason = chunk.finish_reason;
					}
					if (chunk.usage) {
						chunkUsage = chunk.usage;
					}
				}

				if (chunkUsage) {
					totalUsage = chunkUsage;
				}

				const resolvedToolCalls = Array.from(collectedToolCalls.values());

				// No tool calls — assistant message complete
				if (resolvedToolCalls.length === 0 || finishReason === 'stop') {
					const assistantMsg = await this.storage.addMessage(effectiveSessionId, {
						session_id: effectiveSessionId,
						role: 'assistant',
						content: fullContent,
						usage: totalUsage
					});

					// Update session token count
					if (totalUsage) {
						await this.storage.updateTokenCount(effectiveSessionId, totalUsage.total_tokens);
					}

					yield {
						type: 'done',
						messageId: assistantMsg.id,
						usage: totalUsage
					};
					return;
				}

				// Save assistant message with tool_calls
				await this.storage.addMessage(effectiveSessionId, {
					session_id: effectiveSessionId,
					role: 'assistant',
					content: fullContent || '',
					tool_calls: resolvedToolCalls,
					usage: totalUsage
				});

				// Add assistant with tool_calls to messages array for next round
				messages.push({
					role: 'assistant',
					content: fullContent || '',
					tool_calls: resolvedToolCalls
				});

				// Execute each tool call
				for (const tc of resolvedToolCalls) {
					let args: Record<string, unknown> = {};
					try {
						args = JSON.parse(tc.function.arguments);
					} catch {
						// invalid JSON, treat as empty
					}

					yield {
						type: 'tool_call',
						name: tc.function.name,
						args
					};

					try {
						const result = await this.registry.execute(
							tc.function.name,
							args,
							process.cwd()
						);

						yield {
							type: 'tool_result',
							name: tc.function.name,
							success: result.success,
							output: result.output
						};

						// Save tool result
						await this.storage.addMessage(effectiveSessionId, {
							session_id: effectiveSessionId,
							role: 'tool',
							content: result.output || result.error || '',
							tool_call_id: tc.id,
							name: tc.function.name
						});

						messages.push({
							role: 'tool',
							content: result.output || result.error || '',
							tool_call_id: tc.id,
							name: tc.function.name
						});
					} catch (error) {
						if (error instanceof PendingConfirmation) {
							const confirmId = crypto.randomUUID();

							yield {
								type: 'confirm_required',
								confirmId,
								confirmation: error
							};

							const approved = await this.onConfirm(error, confirmId);

							if (approved) {
								try {
									const retryResult = await this.registry.execute(
										error.toolName,
										{ ...error.args, __confirmed: true },
										process.cwd()
									);

									yield {
										type: 'tool_result',
										name: error.toolName,
										success: retryResult.success,
										output: retryResult.output
									};

									await this.storage.addMessage(effectiveSessionId, {
										session_id: effectiveSessionId,
										role: 'tool',
										content: retryResult.output || retryResult.error || '',
										tool_call_id: tc.id,
										name: error.toolName
									});

									messages.push({
										role: 'tool',
										content: retryResult.output || retryResult.error || '',
										tool_call_id: tc.id,
										name: error.toolName
									});
								} catch (retryError) {
									const errMsg = (retryError as Error).message;

									yield {
										type: 'tool_result',
										name: error.toolName,
										success: false,
										output: errMsg
									};

									messages.push({
										role: 'tool',
										content: `执行失败: ${errMsg}`,
										tool_call_id: tc.id,
										name: error.toolName
									});
								}
							} else {
								const cancelMsg = '用户取消了此操作';

								yield {
									type: 'tool_result',
									name: error.toolName,
									success: false,
									output: cancelMsg
								};

								messages.push({
									role: 'tool',
									content: cancelMsg,
									tool_call_id: tc.id,
									name: error.toolName
								});
							}
						} else {
							const errMsg = (error as Error).message;

							yield {
								type: 'tool_result',
								name: tc.function.name,
								success: false,
								output: errMsg
							};

							messages.push({
								role: 'tool',
								content: `工具执行异常: ${errMsg}`,
								tool_call_id: tc.id,
								name: tc.function.name
							});
						}
					}
				}
			}
		} catch (error) {
			yield {
				type: 'error',
				message: (error as Error).message || '未知错误'
			};
		}
	}
}
