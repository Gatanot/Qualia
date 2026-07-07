import { readConfig } from '$lib/config';
import { createStorage } from '$lib/storage';
import { MemoryService } from '$lib/memory';
import type { Memory, MemoryType, MemoryStatus, MemorySourceKind } from '$lib/memory';
import { json } from '@sveltejs/kit';

const VALID_TYPES = ['fact', 'preference', 'rule', 'event'];
const VALID_STATUS = ['active', 'superseded', 'archived'];
const VALID_SOURCE = ['chat', 'summary', 'diary', 'task', 'manual'];

function sanitizeImport(raw: unknown): Memory | null {
	if (!raw || typeof raw !== 'object') return null;
	const r = raw as Record<string, unknown>;
	const type = r.type;
	const content = r.content;
	if (typeof type !== 'string' || !VALID_TYPES.includes(type)) return null;
	if (typeof content !== 'string' || !content.trim()) return null;
	const now = Date.now();
	return {
		id: typeof r.id === 'string' && r.id ? r.id : crypto.randomUUID(),
		type: type as MemoryType,
		content: content.trim(),
		source_session_id: typeof r.source_session_id === 'string' ? r.source_session_id : null,
		source_kind: (typeof r.source_kind === 'string' && VALID_SOURCE.includes(r.source_kind) ? r.source_kind : 'manual') as MemorySourceKind,
		confidence: typeof r.confidence === 'number' ? r.confidence : 1.0,
		status: (typeof r.status === 'string' && VALID_STATUS.includes(r.status) ? r.status : 'active') as MemoryStatus,
		priority: typeof r.priority === 'number' ? r.priority : 0,
		tags: Array.isArray(r.tags) ? r.tags.filter((t): t is string => typeof t === 'string') : [],
		created_at: typeof r.created_at === 'number' ? r.created_at : now,
		updated_at: typeof r.updated_at === 'number' ? r.updated_at : now
	};
}

export async function GET({ url }: { url: URL }) {
	try {
		const config = readConfig();
		const storage = createStorage({ enabled: config.storageEnabled });
		const memoryService = new MemoryService(storage);

		const revisionsFor = url.searchParams.get('revisions');
		if (revisionsFor) {
			return json(await memoryService.listRevisions(revisionsFor));
		}

		if (url.searchParams.get('export')) {
			return json(await memoryService.exportAll());
		}

		const search = url.searchParams.get('search') || undefined;
		const type = url.searchParams.get('type') || undefined;

		const memories = await memoryService.list({
			status: 'active',
			search,
			type: type as MemoryType | undefined
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
					type: type as MemoryType,
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
				const updated = await memoryService.update(id, { content, status: status as MemoryStatus | undefined, priority, tags });
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
			case 'rollback': {
				const { id, revisionId } = body as { id: string; revisionId: string };
				if (!id || !revisionId) return json({ error: 'id 和 revisionId 为必填字段' }, { status: 400 });
				const memory = await memoryService.rollback(id, revisionId);
				return json(memory);
			}
			case 'import': {
				const { memories } = body as { memories: unknown };
				if (!Array.isArray(memories)) {
					return json({ error: 'memories 必须是数组' }, { status: 400 });
				}
				const clean: Memory[] = [];
				for (const raw of memories) {
					const m = sanitizeImport(raw);
					if (m) clean.push(m);
				}
				const count = await memoryService.import(clean);
				return json({ ok: true, imported: count, skipped: memories.length - count });
			}
			default:
				return json({ error: '未知操作' }, { status: 400 });
		}
	} catch (e) {
		return json({ error: (e as Error).message }, { status: 500 });
	}
}
