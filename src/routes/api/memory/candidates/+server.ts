import { readConfig } from '$lib/config';
import { createStorage } from '$lib/storage';
import { MemoryService } from '$lib/memory';
import { json } from '@sveltejs/kit';

export async function GET() {
	try {
		const config = readConfig();
		const storage = createStorage({ enabled: config.storageEnabled });
		const candidates = await storage.listCandidates('pending');
		return json(candidates);
	} catch (e) {
		return json({ error: (e as Error).message }, { status: 500 });
	}
}

export async function POST({ request }: { request: Request }) {
	try {
		const body = await request.json();
		const { action, id, editedContent } = body as {
			action: string; id: string; editedContent?: string;
		};

		if (!id) return json({ error: 'id 为必填字段' }, { status: 400 });

		const config = readConfig();
		const storage = createStorage({ enabled: config.storageEnabled });
		const memoryService = new MemoryService(storage);

		switch (action) {
			case 'accept': {
				const memory = await memoryService.resolve(id, 'accept', editedContent);
				return json({ ok: true, memory });
			}
			case 'ignore': {
				await memoryService.resolve(id, 'ignore');
				return json({ ok: true });
			}
			default:
				return json({ error: '未知操作' }, { status: 400 });
		}
	} catch (e) {
		return json({ error: (e as Error).message }, { status: 500 });
	}
}
