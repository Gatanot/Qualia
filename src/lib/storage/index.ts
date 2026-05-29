import type { Storage } from './types';
import { MemoryStorage } from './memory';
import { SQLiteStorage } from './sqlite';

export type { Storage, Session, MessageRecord, MessageQueryOptions } from './types';
export { MemoryStorage } from './memory';
export { SQLiteStorage } from './sqlite';

export interface StorageConfig {
	enabled: boolean;
	dbPath?: string;
}

let _memory: MemoryStorage | null = null;
let _sqlite: SQLiteStorage | null = null;

export function createStorage(config: StorageConfig): Storage {
	if (config.enabled) {
		if (!_sqlite) _sqlite = new SQLiteStorage(config.dbPath || 'data/db.sqlite');
		return _sqlite;
	}
	if (!_memory) _memory = new MemoryStorage();
	return _memory;
}
