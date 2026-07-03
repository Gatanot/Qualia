import type { Storage } from './types.js';
import { MemoryStorage } from './memory.js';
import { SQLiteStorage } from './sqlite.js';
import { getDataPath } from '../paths.js';

export type { Storage, Session, MessageRecord, MessageQueryOptions, MessageSearchResult } from './types.js';
export { MemoryStorage } from './memory.js';
export { SQLiteStorage } from './sqlite.js';

export interface StorageConfig {
	enabled: boolean;
	dbPath?: string;
}

let _memory: MemoryStorage | null = null;
let _sqlite: SQLiteStorage | null = null;

export function createStorage(config: StorageConfig): Storage {
	if (config.enabled) {
		if (!_sqlite) _sqlite = new SQLiteStorage(config.dbPath || getDataPath('db.sqlite'));
		return _sqlite;
	}
	if (!_memory) _memory = new MemoryStorage();
	return _memory;
}
