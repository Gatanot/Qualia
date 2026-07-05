import { json } from '@sveltejs/kit';
import { createStorage } from '@gatanot/qualia_core/storage';

export async function GET({ url }: { url: URL }) {
	const limitParam = url.searchParams.get('limit');
	const limit = limitParam ? parseInt(limitParam, 10) : 100;

	if (Number.isNaN(limit) || limit < 1 || limit > 1000) {
		return json({ error: 'limit must be 1-1000' }, { status: 400 });
	}

	try {
		const storage = createStorage({ enabled: true });
		const logs = await storage.listAuditLogs(limit);
		return json(logs);
	} catch (e) {
		return json({ error: (e as Error).message }, { status: 500 });
	}
}
