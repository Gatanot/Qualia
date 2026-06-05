import { readConfig, getActiveProvider, getContextWindow, getActiveModel } from '$lib/config';
import { createProvider } from '$lib/provider';
import { createStorage } from '$lib/storage';
import { ToolRegistry, readFileTool, writeFileTool, deleteFileTool, execTool, writeMemoryTool } from '$lib/tool';
import { AgentLoop, ContextBuilder } from '$lib/agent';
import type { AgentEvent, ConfirmFn } from '$lib/agent';

import { pendingConfirms } from '$lib/chat-confirm';

export async function POST({ request }: { request: Request }) {
	try {
		const body = await request.json();
		let { sessionId, message, clientMessageId } = body as {
			sessionId?: string;
			message: string;
			clientMessageId?: string;
		};

		if (!message?.trim()) {
			return new Response(JSON.stringify({ error: '消息不能为空' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		const config = readConfig();
		const providerConfig = getActiveProvider();
		if (!providerConfig) {
			return new Response(JSON.stringify({ error: '未配置活跃的 AI 供应商，请先在设置中添加' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		const model = getActiveModel();
		if (!model) {
			return new Response(JSON.stringify({ error: '未选择模型，请先在设置中配置供应商' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		const runtimeConfig = { ...providerConfig, activeModel: model.id, contextWindow: model.contextWindow };
		const provider = createProvider(runtimeConfig);
		const storage = createStorage({ enabled: config.storageEnabled });

		const contextWindow = getContextWindow();

		const registry = new ToolRegistry();
		registry.register(readFileTool);
		registry.register(writeFileTool);
		registry.register(deleteFileTool);
		registry.register(execTool);
		registry.register(writeMemoryTool);

		const contextBuilder = new ContextBuilder();

		const onConfirm: ConfirmFn = async (_conf, confirmId) => {
			return new Promise((resolve) => {
				pendingConfirms.set(confirmId, { resolve });
				request.signal.addEventListener('abort', () => {
					pendingConfirms.delete(confirmId);
					resolve(false);
				}, { once: true });
			});
		};

		const agent = new AgentLoop(provider, storage, registry, onConfirm, request.signal);

		let sid = sessionId;
		if (!sid) {
			const session = await storage.createSession();
			sid = session.id;
		} else {
			const exists = await storage.getSession(sid);
			if (!exists) {
				const session = await storage.createSession();
				sid = session.id;
			}
		}

		const buildResult = await contextBuilder.build(
			sid,
			message,
			storage,
			registry,
			contextWindow,
			config.systemPrompt
		);

		const stream = new ReadableStream({
			async start(controller) {
				function send(event: AgentEvent) {
					controller.enqueue(`data: ${JSON.stringify(event)}\n\n`);
				}

				try {
					for await (const event of agent.run(sid!, message, buildResult, clientMessageId)) {
						if (event.type === 'done') {
							send({ ...event, contextWindow });
						} else {
							send(event);
						}
					}
				} catch (e) {
					send({ type: 'error', message: (e as Error).message || '未知错误' });
				}

				controller.close();
			}
		});

		return new Response(stream, {
			headers: {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache, no-transform',
				'Connection': 'keep-alive',
				'X-Accel-Buffering': 'no',
				'X-Session-Id': sid
			}
		});
	} catch (e) {
		return new Response(JSON.stringify({ error: (e as Error).message }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}
