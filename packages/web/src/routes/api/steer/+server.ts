import { pendingSteering } from '@gatanot/qualia_core/chat-steering';

export async function POST({ request }: { request: Request }) {
	try {
		const body = await request.json();
		const { sessionId, messageId, message } = body as {
			sessionId?: string;
			messageId?: string;
			message?: string;
		};

		if (!sessionId || !messageId || !message?.trim()) {
			return new Response(JSON.stringify({ error: '缺少参数' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		if (!pendingSteering.has(sessionId)) {
			pendingSteering.set(sessionId, []);
		}
		pendingSteering.get(sessionId)!.push({ messageId, text: message });

		return new Response(JSON.stringify({ ok: true }), {
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (e) {
		return new Response(JSON.stringify({ error: (e as Error).message }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}
