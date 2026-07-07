export type MemoryType = 'fact' | 'preference' | 'rule' | 'event';

export type MemorySourceKind = 'chat' | 'summary' | 'diary' | 'task' | 'manual';

export type MemoryStatus = 'active' | 'superseded' | 'archived';

export interface Memory {
	id: string;
	type: MemoryType;
	content: string;
	source_session_id: string | null;
	source_kind: MemorySourceKind;
	confidence: number;
	status: MemoryStatus;
	priority: number;
	tags: string[];
	created_at: number;
	updated_at: number;
}

export interface MemorySearchContext {
	query: string;
	budget?: number;
}

export interface MemoryListFilters {
	type?: MemoryType;
	status?: MemoryStatus;
	search?: string;
	limit?: number;
	offset?: number;
}
