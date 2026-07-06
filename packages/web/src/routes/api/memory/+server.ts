import { readConfig } from '@gatanot/qualia_core/config';
import { createStorage } from '@gatanot/qualia_core/storage';
import { MemoryService } from '@gatanot/qualia_core/memory';
import { json } from '@sveltejs/kit';

export async function GET({ url }: { url: URL }) {
	try {
		const config = readConfig();
		const storage = createStorage({ enabled: config.storageEnabled });
		const memoryService = new MemoryService(storage);

		const search = url.searchParams.get('search') || undefined;
		const type = url.searchParams.get('type') || undefined;

		const memories = await memoryService.list({
			status: 'active',
			search,
			type: type as 'fact' | 'preference' | 'rule' | 'event' | undefined
		});

		return json(memories);
	} catch (e) {
		return json({ error: (e as Error).message }, { status: 500 });
	}
}

export async function POST({ request }: { request: Request }) {
	try {
		const body = await request.json();
		const { action } = body as { action: string; [key: string]: unknown };

		const config = readConfig();
		const storage = createStorage({ enabled: config.storageEnabled });
		const memoryService = new MemoryService(storage);

		switch (action) {
			case 'create': {
				const { type, content, confidence, priority, tags } = body as {
					type: string; content: string;
					confidence?: number; priority?: number; tags?: string[];
				};
				if (!type || !content) {
					return json({ error: 'type 和 content 为必填字段' }, { status: 400 });
				}
				const memory = await storage.createMemory({
					type: type as 'fact' | 'preference' | 'rule' | 'event',
					content,
					source_session_id: null,
					source_kind: 'manual',
					confidence: confidence ?? 1.0,
					status: 'active',
					priority: priority ?? 0,
					tags: tags || []
				});
				return json(memory);
			}
			case 'update': {
				const { id, content, status, priority, tags } = body as {
					id: string; content?: string; status?: string; priority?: number; tags?: string[];
				};
				if (!id) return json({ error: 'id 为必填字段' }, { status: 400 });
				const updated = await memoryService.update(id, { content, status: status as 'active' | 'superseded' | 'archived' | undefined, priority, tags });
				return json(updated);
			}
			case 'archive': {
				const { id } = body as { id: string };
				if (!id) return json({ error: 'id 为必填字段' }, { status: 400 });
				await memoryService.archive(id);
				return json({ ok: true });
			}
			case 'delete': {
				const { id } = body as { id: string };
				if (!id) return json({ error: 'id 为必填字段' }, { status: 400 });
				await memoryService.delete(id);
				return json({ ok: true });
			}
			default:
				return json({ error: '未知操作' }, { status: 400 });
		}
	} catch (e) {
		return json({ error: (e as Error).message }, { status: 500 });
	}
}
