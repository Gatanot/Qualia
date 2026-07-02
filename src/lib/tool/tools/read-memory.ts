import { readFileSync, existsSync } from 'node:fs';
import type { ToolDef, ToolResult } from '../types';
import { getDataPath } from '$lib/paths';

const MEMORY_PATH = getDataPath('memory.md');

export const readMemoryTool: ToolDef = {
	name: 'read_memory',
	description: '读取长期记忆（data/memory.md）。可选传入 query 进行关键词搜索，只返回匹配的内容行及其所属分类标题。不传 query 时返回完整记忆内容。当你需要了解之前存储过的关于用户、自己或重要事件的信息时使用。注意：会话创建时的记忆快照可能已过时，此工具始终返回最新内容。',
	parameters: {
		type: 'object',
		properties: {
			query: {
				type: 'string',
				description: '可选。搜索关键词（大小写不敏感），只返回包含该词的内容行及其所属分类标题。不传则返回全部记忆。'
			}
		},
		required: []
	},

	async execute(args: Record<string, unknown>, _ctx: import('../env').ToolContext): Promise<ToolResult> {
		try {
			if (!existsSync(MEMORY_PATH)) {
				return { success: true, output: '（暂无记忆内容）' };
			}
			const content = readFileSync(MEMORY_PATH, 'utf-8');
			if (!content.trim()) {
				return { success: true, output: '（暂无记忆内容）' };
			}

			const query = args.query as string | undefined;
			if (!query?.trim()) {
				return { success: true, output: content };
			}

			const lines = content.split('\n');
			const lowerQuery = query.trim().toLowerCase();
			const resultLines: string[] = [];
			let lastHeader = '';

			for (const line of lines) {
				const isHeader = line.startsWith('## ');
				if (isHeader) {
					lastHeader = line;
				}
				const isContent = line.trim() !== '' && !line.startsWith('## ');
				if (isContent && line.toLowerCase().includes(lowerQuery)) {
					if (lastHeader && !resultLines.includes(lastHeader)) {
						resultLines.push(lastHeader);
						resultLines.push('');
					}
					resultLines.push(line);
				}
			}

			if (resultLines.length === 0) {
				return { success: true, output: `（记忆中没有找到与 "${query.trim()}" 相关的内容）` };
			}

			return { success: true, output: resultLines.join('\n') };
		} catch (error) {
			return { success: false, output: '', error: `读取记忆失败: ${(error as Error).message}` };
		}
	}
};
