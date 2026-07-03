import { runSummarizeJob } from '@gatanot/qualia_core/agent/background';

export async function POST({ request }: { request: Request }) {
	try {
		const body = await request.json().catch(() => ({}));
		const force = body.force === true;

		const result = await runSummarizeJob(force);
		return new Response(JSON.stringify(result), {
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (e) {
		return new Response(JSON.stringify({ error: (e as Error).message }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}
