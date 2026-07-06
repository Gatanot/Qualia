import type { ToolDef, ToolResult } from '../types.js';
import { MemoryService } from '../../memory/index.js';
import { readConfig } from '../../config/index.js';
import { createStorage } from '../../storage/index.js';

export const readMemoryTool: ToolDef = {
	name: 'read_memory',
	description: 'Read long-term memories. Optionally pass a query for keyword search — returns matching memories with their type and status. Use when you need to recall previously stored information about users, preferences, rules, or important events. Searches active memories only; pending candidates are not included.',
	parameters: {
		type: 'object',
		properties: {
			query: {
				type: 'string',
				description: 'Optional. Search keyword. Returns matching memories. Omit to return all active memories.'
			},
			type: {
				type: 'string',
				description: 'Optional. Filter by memory type: fact, preference, rule, event',
				enum: ['fact', 'preference', 'rule', 'event']
			}
		},
		required: []
	},

	async execute(args: Record<string, unknown>, _ctx: import('../env.js').ToolContext): Promise<ToolResult> {
		try {
			const config = readConfig();
			const storage = createStorage({ enabled: config.storageEnabled });
			const memoryService = new MemoryService(storage);

			const query = (args.query as string)?.trim();
			const typeFilter = args.type as string | undefined;

			const memories = await memoryService.list({
				status: 'active',
				search: query || undefined,
				type: typeFilter as 'fact' | 'preference' | 'rule' | 'event' | undefined
			});

			if (memories.length === 0) {
				const hint = query ? `（没有找到与 "${query}" 相关的激活记忆）` : '（暂无激活的长期记忆）';
				return { success: true, output: hint };
			}

			const lines: string[] = memories.map((m) => {
				const typeLabel = { fact: '事实', preference: '偏好', rule: '规则', event: '事件' }[m.type] || m.type;
				return `[${typeLabel}] (置信度: ${m.confidence.toFixed(1)})\n${m.content}`;
			});

			return { success: true, output: lines.join('\n\n') };
		} catch (error) {
			return { success: false, output: '', error: `读取记忆失败: ${(error as Error).message}` };
		}
	}
};
