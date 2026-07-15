import type { Storage } from './types';
import { MemoryStorage } from './memory';
import { SQLiteStorage } from './sqlite';
import { getDataPath } from '$lib/paths';

export type { Storage, Session, MessageRecord, MessageQueryOptions, MessageSearchResult } from './types';
export { MemoryStorage } from './memory';
export { SQLiteStorage } from './sqlite';

export interface StorageConfig {
	enabled: boolean;
	dbPath?: string;
}

let _memory: MemoryStorage | null = null;
let _sqlite: SQLiteStorage | null = null;
let _sqlitePath: string | null = null;

export function createStorage(config: StorageConfig): Storage {
	if (config.enabled) {
		const path = config.dbPath || getDataPath('db.sqlite');
		if (_sqlite && _sqlitePath !== path) {
			_sqlite.close();
			_sqlite = null;
		}
		if (!_sqlite) {
			_sqlite = new SQLiteStorage(path);
			_sqlitePath = path;
		}
		return _sqlite;
	}
	if (!_memory) _memory = new MemoryStorage();
	return _memory;
}

/** 关闭缓存的 SQLite 连接（进程退出时调用，释放文件锁）。 */
export function closeStorage(): void {
	if (_sqlite) {
		_sqlite.close();
		_sqlite = null;
		_sqlitePath = null;
	}
}
