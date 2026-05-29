import { pendingConfirms } from '$lib/chat-confirm';

export async function POST({ request }) {
	try {
		const body = await request.json();
		const { confirmId, approved } = body as { confirmId: string; approved: boolean };

		if (!confirmId) {
			return new Response(JSON.stringify({ error: '缺少 confirmId' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		const pending = pendingConfirms.get(confirmId);
		if (!pending) {
			return new Response(JSON.stringify({ error: '确认请求不存在或已过期' }), {
				status: 404,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		pendingConfirms.delete(confirmId);
		pending.resolve(approved === true);

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
