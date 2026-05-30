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
				const session = await storage.createSession();
				return new Response(JSON.stringify(session), {
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
