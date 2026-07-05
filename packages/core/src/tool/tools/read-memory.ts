import { readFileSync, existsSync } from 'node:fs';
import type { ToolDef, ToolResult } from '../types.js';
import { getDataPath } from '../../paths.js';

const MEMORY_PATH = getDataPath('memory.md');

export const readMemoryTool: ToolDef = {
	name: 'read_memory',
	description: 'Read long-term memory (data/memory.md). Optionally pass a query for keyword search — returns matching lines with their category headers. Without query, returns the full memory content. Use when you need to recall previously stored information about users, yourself, or important events. Note: the memory snapshot taken at session creation may be stale; this tool always returns the latest.',
	parameters: {
		type: 'object',
		properties: {
			query: {
				type: 'string',
				description: 'Optional. Search keyword (case-insensitive). Returns matching lines with their category headers. Omit to return all memory.'
			}
		},
		required: []
	},

	async execute(args: Record<string, unknown>, _ctx: import('../env.js').ToolContext): Promise<ToolResult> {
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
