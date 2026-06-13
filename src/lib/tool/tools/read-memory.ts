import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { ToolDef, ToolResult } from '../types';

const MEMORY_PATH = join(process.cwd(), 'data', 'memory.md');

export const readMemoryTool: ToolDef = {
	name: 'read_memory',
	description: '读取当前最新的长期记忆内容（data/memory.md）。当你需要了解之前存储过的关于用户、自己或重要事件的信息时使用。注意：会话创建时的记忆快照可能已过时，此工具始终返回最新内容。',
	parameters: {
		type: 'object',
		properties: {},
		required: []
	},

	async execute(_args: Record<string, unknown>, _workspaceRoot: string): Promise<ToolResult> {
		try {
			if (!existsSync(MEMORY_PATH)) {
				return { success: true, output: '（暂无记忆内容）' };
			}
			const content = readFileSync(MEMORY_PATH, 'utf-8');
			if (!content.trim()) {
				return { success: true, output: '（暂无记忆内容）' };
			}
			return { success: true, output: content };
		} catch (error) {
			return { success: false, output: '', error: `读取记忆失败: ${(error as Error).message}` };
		}
	}
};
