import { readConfig, getActiveProvider, getContextWindow } from '$lib/config';
import { createProvider } from '$lib/provider';
import { createStorage } from '$lib/storage';
import { ToolRegistry, readFileTool, writeFileTool, deleteFileTool, execTool } from '$lib/tool';
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

		const provider = createProvider(providerConfig);
		const storage = createStorage({ enabled: config.storageEnabled });

		if (!providerConfig.contextWindow) {
			providerConfig.contextWindow = getContextWindow();
		}
		const registry = new ToolRegistry();
		registry.register(readFileTool);
		registry.register(writeFileTool);
		registry.register(deleteFileTool);
		registry.register(execTool);

		const contextBuilder = new ContextBuilder();

		const onConfirm: ConfirmFn = async (_conf, confirmId) => {
			return new Promise((resolve) => {
				pendingConfirms.set(confirmId, { resolve });
			});
		};

		const agent = new AgentLoop(provider, storage, registry, onConfirm);

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
			providerConfig,
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
							send({ ...event, contextWindow: providerConfig.contextWindow });
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
				'Cache-Control': 'no-cache',
				'Connection': 'keep-alive',
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
