import { readConfig, getProviderForModel, getContextWindow, getActiveModel } from '$lib/config';
import { createProvider } from '$lib/ai';
import type { ImageContent } from '$lib/ai';
import { createStorage } from '$lib/storage';
import { ToolRegistry, CORE_TOOLS, SCHEDULING_TOOLS, createSearchHistoryTool } from '$lib/tool';
import { AgentLoop, ContextBuilder, AgentLogger } from '$lib/agent';
import type { AgentEvent, ConfirmFn } from '$lib/agent';

import { pendingConfirms } from '$lib/chat-confirm';
import { sessionLock } from '$lib/concurrency';

export async function POST({ request }: { request: Request }) {
	try {
		const body = await request.json();
		let { sessionId, message, images, clientMessageId } = body as {
			sessionId?: string;
			message: string;
			images?: { url: string; detail?: 'low' | 'high' | 'auto' }[];
			clientMessageId?: string;
		};

		if (!message?.trim()) {
			return new Response(JSON.stringify({ error: '消息不能为空' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		const config = readConfig();
		if (!config.activeModel) {
			return new Response(JSON.stringify({ error: '未选择模型，请先在设置中配置供应商' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		const providerConfig = getProviderForModel(config.activeModel);
		if (!providerConfig) {
			return new Response(JSON.stringify({ error: '未找到对应模型的供应商配置' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		const model = getActiveModel();
		if (!model) {
			return new Response(JSON.stringify({ error: '未选择模型' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		const runtimeConfig = { ...providerConfig, activeModel: model.id, contextWindow: model.contextWindow };
		const provider = createProvider(runtimeConfig);
		const storage = createStorage({ enabled: config.storageEnabled });

		const contextWindow = getContextWindow();

		const registry = new ToolRegistry();
		for (const t of CORE_TOOLS) registry.register(t);
		for (const t of SCHEDULING_TOOLS) registry.register(t);
		registry.register(createSearchHistoryTool(storage));

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

		const agent = new AgentLoop(provider, storage, registry, onConfirm, request.signal, new AgentLogger(sessionId || '(new)'));

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

		const imageContents: ImageContent[] = (images || []).map((img) => ({
			type: 'image_url' as const,
			image_url: { url: img.url, detail: img.detail || 'auto' }
		}));

		const storageContent = imageContents.length > 0
			? JSON.stringify([{ type: 'text', text: message }, ...imageContents])
			: message;

		const buildResult = await contextBuilder.build(
			sid,
			message,
			imageContents,
			storage,
			contextWindow,
			config.systemPrompt
		);

		const stream = new ReadableStream({
			async start(controller) {
				function send(event: AgentEvent) {
					controller.enqueue(`data: ${JSON.stringify(event)}\n\n`);
				}

				let release: (() => void) | undefined;

				try {
					release = await sessionLock.acquire(sid!);
					for await (const event of agent.run(sid!, storageContent, buildResult, clientMessageId)) {
						if (event.type === 'done') {
							send({ ...event, contextWindow });
						} else {
							send(event);
						}
					}
				} catch (e) {
					send({ type: 'error', message: (e as Error).message || '未知错误' });
				} finally {
					if (release) release();
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
