/**
 * MemoryService — 记忆系统核心服务
 *
 * 封装所有记忆操作：候选创建、候选处理、记忆检索、上下文注入。
 * 路由、工具、摘要 worker、任务 executor 都通过此服务操作记忆，
 * 不直接访问 SQLite 表。
 */

import type { Storage } from '../storage/index.js';
import type {
	Memory,
	MemoryCandidate,
	ProposeMemoryInput,
	MemorySearchContext,
	MemoryListFilters
} from './types.js';

const DEFAULT_RULE_BUDGET = 20;
const DEFAULT_GENERAL_BUDGET = 40;

export class MemoryService {
	constructor(private storage: Storage) {}

	async propose(input: ProposeMemoryInput): Promise<MemoryCandidate> {
		return this.storage.createCandidate({
			proposed_type: input.type,
			content: input.content,
			reason: input.reason || '',
			confidence: input.confidence ?? 1.0,
			status: 'pending'
		});
	}

	async listCandidates(): Promise<MemoryCandidate[]> {
		return this.storage.listCandidates('pending');
	}

	async resolve(id: string, action: 'accept' | 'ignore', editedContent?: string): Promise<Memory | null> {
		const candidate = await this.storage.getCandidate(id);
		if (!candidate) throw new Error(`候选记忆不存在: ${id}`);

		if (action === 'ignore') {
			await this.storage.resolveCandidate(id, 'ignored');
			return null;
		}

		const memory = await this.storage.createMemory({
			type: candidate.proposed_type,
			content: editedContent || candidate.content,
			source_session_id: null,
			source_kind: 'manual',
			confidence: candidate.confidence,
			status: 'active',
			priority: candidate.proposed_type === 'rule' ? 10 : 0,
			tags: []
		});

		await this.storage.resolveCandidate(id, 'accepted');
		return memory;
	}

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
