import { readConfig } from '$lib/config';
import { createStorage } from '$lib/storage';

export async function POST({ request }: { request: Request }) {
	try {
		const body = await request.json();
		const { action, sessionId, messageId } = body as {
			action: string;
			sessionId: string;
			messageId: string;
		};

		if (!sessionId || !messageId) {
			return new Response(JSON.stringify({ error: '缺少参数' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		const config = readConfig();
		const storage = createStorage({ enabled: config.storageEnabled });

		if (action === 'deleteFrom') {
			await storage.deleteMessagesFrom(sessionId, messageId);
			return new Response(JSON.stringify({ ok: true }), {
				headers: { 'Content-Type': 'application/json' }
			});
		}

		return new Response(JSON.stringify({ error: '未知操作' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (e) {
		return new Response(JSON.stringify({ error: (e as Error).message }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}
