import type { Storage } from './types';
import { MemoryStorage } from './memory';
import { SQLiteStorage } from './sqlite';

export type { Storage, Session, MessageRecord, MessageQueryOptions } from './types';
export { MemoryStorage } from './memory';
export { SQLiteStorage } from './sqlite';

/** 存储工厂配置 */
export interface StorageConfig {
	/** 是否启用持久化（true → SQLite / false → 内存） */
	enabled: boolean;
	/** SQLite 数据库文件路径，默认 'data/db.sqlite' */
	dbPath?: string;
}

/**
 * 创建存储实例
 *
 * 根据 config.enabled 选择 SQLiteStorage（持久化）或 MemoryStorage（内存）。
 *
 * @example
 * ```ts
 * const storage = createStorage({ enabled: true });
 * const session = await storage.createSession('新对话');
 * ```
 */
export function createStorage(config: StorageConfig): Storage {
	if (config.enabled) {
		return new SQLiteStorage(config.dbPath || 'data/db.sqlite');
	}
	return new MemoryStorage();
}
