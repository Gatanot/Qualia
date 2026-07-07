/**
 * MemoryService — 记忆系统核心服务
 *
 * 封装记忆的读取、更新、归档、删除、修订/回滚、检索注入、导入导出。
 * 写入走 propose_memory 工具的内联确认（storage.createMemory），不在此。
 * 路由、工具、任务 executor 都通过此服务操作记忆，不直接访问 SQLite 表。
 */

import type { Storage } from '$lib/storage';
import type {
	Memory,
	MemoryRevision,
	MemorySearchContext,
	MemoryListFilters
} from './types';

const DEFAULT_RULE_BUDGET = 20;
const DEFAULT_GENERAL_BUDGET = 40;

export class MemoryService {
	constructor(private storage: Storage) {}

	async list(filters?: MemoryListFilters): Promise<Memory[]> {
		return this.storage.listMemories(filters);
	}

	async get(id: string): Promise<Memory | null> {
		return this.storage.getMemory(id);
	}

	async update(id: string, patch: Partial<Pick<Memory, 'content' | 'status' | 'priority' | 'tags'>>): Promise<Memory> {
		return this.storage.updateMemory(id, patch);
	}

	async archive(id: string): Promise<void> {
		await this.storage.archiveMemory(id);
	}

	async delete(id: string): Promise<void> {
		await this.storage.deleteMemory(id);
	}

	async exportAll(): Promise<Memory[]> {
		return this.storage.listAllMemories();
	}

	async import(memories: Memory[]): Promise<number> {
		return this.storage.importMemories(memories);
	}

	async listRevisions(memoryId: string): Promise<MemoryRevision[]> {
		return this.storage.listMemoryRevisions(memoryId);
	}

	async rollback(memoryId: string, revisionId: string): Promise<Memory> {
		return this.storage.rollbackMemory(memoryId, revisionId);
	}

	/**
	 * searchContext — 检索当前上下文相关的长期记忆
	 *
	 * 基于用户消息进行文本匹配，按类型分组注入。
	 * 预算策略：rule 最多 20 条 > 其他 fact/preference/event 最多 40 条。
	 */
	async searchContext(ctx: MemorySearchContext): Promise<Memory[]> {
		const budget = ctx.budget || (DEFAULT_RULE_BUDGET + DEFAULT_GENERAL_BUDGET);
		const allActive = await this.storage.listMemories({ status: 'active' });

		const scored = allActive.map((m) => ({
			memory: m,
			score: this._score(m, ctx.query)
		}));

		const sorted = scored
			.filter((s) => s.score > 0)
			.sort((a, b) => b.score - a.score);

		const result: Memory[] = [];
		const budgets = { rule: DEFAULT_RULE_BUDGET, general: DEFAULT_GENERAL_BUDGET };

		for (const { memory } of sorted) {
			if (result.length >= budget) break;

			if (memory.type === 'rule' && budgets.rule > 0) {
				result.push(memory);
				budgets.rule--;
			} else if (memory.type !== 'rule' && budgets.general > 0) {
				result.push(memory);
				budgets.general--;
			}
		}

		return result;
	}

	private _score(memory: Memory, query: string): number {
		let score = 0;
		const contentLower = memory.content.toLowerCase();
		const queryLower = query.toLowerCase();

		for (const word of queryLower.split(/\s+/)) {
			if (word.length >= 2 && contentLower.includes(word)) {
				score += 10;
			}
		}

		if (memory.type === 'rule') score += 50;
		if (memory.confidence >= 0.8) score += 5;
		score += memory.priority;

		return score;
	}
}
