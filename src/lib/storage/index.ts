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

export function createStorage(config: StorageConfig): Storage {
	if (config.enabled) {
		return new SQLiteStorage(config.dbPath || 'data/db.sqlite');
	}
	return new MemoryStorage();
}
