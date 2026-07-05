import { readConfig } from '$lib/config';
import { createStorage } from '$lib/storage';

export async function GET() {
	try {
		const config = readConfig();
		const storage = createStorage({ enabled: config.storageEnabled });
		const sessions = await storage.listSessions();
		return new Response(JSON.stringify(sessions), {
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (e) {
		return new Response(JSON.stringify({ error: (e as Error).message }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}

export async function POST({ request }: { request: Request }) {
	try {
		const body = await request.json();
		const { action } = body as { action: string; [key: string]: unknown };

		const config = readConfig();
		const storage = createStorage({ enabled: config.storageEnabled });

		switch (action) {
			case 'create': {
				const { workspace } = body as { workspace?: string };
				const session = await storage.createSession(undefined, workspace || '');
				return new Response(JSON.stringify(session), {
					headers: { 'Content-Type': 'application/json' }
				});
			}
			case 'fork': {
				const { sessionId, messageId } = body as { sessionId: string; messageId: string };
				if (!sessionId || !messageId) {
					return new Response(JSON.stringify({ error: '缺少 sessionId 或 messageId' }), {
						status: 400,
						headers: { 'Content-Type': 'application/json' }
					});
				}
				const parentSession = await storage.getSession(sessionId);
				if (!parentSession) {
					return new Response(JSON.stringify({ error: '会话不存在' }), {
						status: 404,
						headers: { 'Content-Type': 'application/json' }
					});
				}
				const allMessages = await storage.getMessages(sessionId);
				const targetMsg = allMessages.find((m) => m.id === messageId);
				if (!targetMsg) {
					return new Response(JSON.stringify({ error: '消息不存在' }), {
						status: 404,
						headers: { 'Content-Type': 'application/json' }
					});
				}
				const beforeMessages = allMessages.filter((m) => m.seq < targetMsg.seq && m.role !== 'system');
				const newSession = await storage.createSession(`[分叉] ${parentSession.title}`, parentSession.workspace);
				for (const msg of beforeMessages) {
					await storage.addMessage(newSession.id, {
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
				return new Response(JSON.stringify({ newSessionId: newSession.id, draftContent: targetMsg.content }), {
					headers: { 'Content-Type': 'application/json' }
				});
			}
			case 'setTitle': {
				const { sessionId, title } = body as { sessionId: string; title: string };
				await storage.setSessionTitle(sessionId, title);
				return new Response(JSON.stringify({ ok: true }), {
					headers: { 'Content-Type': 'application/json' }
				});
			}
			case 'delete': {
				const { sessionId } = body as { sessionId: string };
				await storage.deleteSession(sessionId);
				return new Response(JSON.stringify({ ok: true }), {
					headers: { 'Content-Type': 'application/json' }
				});
			}
			case 'getMessages': {
				const { sessionId } = body as { sessionId: string };
				const messages = await storage.getMessages(sessionId);
				return new Response(JSON.stringify(messages), {
					headers: { 'Content-Type': 'application/json' }
				});
			}
			case 'listWorkspaces': {
				const workspaces = await storage.listWorkspaces();
				return new Response(JSON.stringify(workspaces), {
					headers: { 'Content-Type': 'application/json' }
				});
			}
			default:
				return new Response(JSON.stringify({ error: '未知操作' }), {
					status: 400,
					headers: { 'Content-Type': 'application/json' }
				});
		}
	} catch (e) {
		return new Response(JSON.stringify({ error: (e as Error).message }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}
