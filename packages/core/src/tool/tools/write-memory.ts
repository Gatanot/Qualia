import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import type { ToolDef, ToolResult } from '../types.js';
import { getDataDir, getDataPath } from '../../paths.js';

const SECTION_META = `
## 关于我自己 (Qualia)
我是一个运行在本地环境中的 AI 伴侣，帮助用户完成开发工作和日常任务。

## 关于用户
（待记录）

## 重要事件
（待记录）
`;

const MEMORY_PATH = getDataPath('memory.md');

function ensureMemoryFile(): void {
	const dir = getDataDir();
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}
	if (!existsSync(MEMORY_PATH) || !readFileSync(MEMORY_PATH, 'utf-8').includes('## 关于用户')) {
		writeFileSync(MEMORY_PATH, SECTION_META.trim().replace(/\r/g, '') + '\n', 'utf-8');
	}
}

const CATEGORY_HEADERS: Record<string, string> = {
	self: '## 关于我自己 (Qualia)',
	user: '## 关于用户',
	event: '## 重要事件'
};

function updateSection(current: string, category: string, content: string): string {
	const header = CATEGORY_HEADERS[category];
	if (!header) return current;

	const sections = ['self', 'user', 'event'];
	const idx = sections.indexOf(category);
	let result = '';
	let inTarget = false;
	let done = false;

	for (const line of current.split('\n')) {
		const isHeader = line.startsWith('## ');
		if (isHeader) {
			if (inTarget) {
				result += content + '\n\n';
				done = true;
			}
			inTarget = (line === header);
		} else if (inTarget && !done) {
			continue;
		}
		result += line + '\n';
	}

	if (inTarget && !done) {
		result += content;
	}

	return result.trim() + '\n';
}

export const writeMemoryTool: ToolDef = {
	name: 'write_memory',
	description: 'Write important information to long-term memory (memory.md). Only use for information worth remembering long-term. Content is automatically injected into the system prompt of future sessions. Three categories: self (about yourself), user (about the user), event (important milestones). Each call overwrites the entire content of the given category.',
	parameters: {
		type: 'object',
		properties: {
			category: {
				type: 'string',
				description: 'Memory category: self (about yourself), user (about the user), event (important events)',
				enum: ['self', 'user', 'event']
			},
			content: {
				type: 'string',
				description: 'New content for this category (replaces existing). Write in Chinese, concise and brief, one item per line.'
			}
		},
		required: ['category', 'content']
	},

	async execute(args: Record<string, unknown>, _ctx: import('../env').ToolContext): Promise<ToolResult> {
		const category = args.category as string;
		const content = args.content as string;

		if (!category || !CATEGORY_HEADERS[category]) {
			return { success: false, output: '', error: `无效的类别: ${category}，可选: self, user, event` };
		}
		if (!content?.trim()) {
			return { success: false, output: '', error: 'content 不能为空' };
		}

		try {
			ensureMemoryFile();
			const current = readFileSync(MEMORY_PATH, 'utf-8').replace(/\r/g, '');
			const updated = updateSection(current, category, content.trim());
			writeFileSync(MEMORY_PATH, updated, 'utf-8');

			const header = CATEGORY_HEADERS[category];
			return {
				success: true,
				output: `已更新记忆: ${header}\n${content}`
			};
		} catch (error) {
			return { success: false, output: '', error: `写入失败: ${(error as Error).message}` };
		}
	}
};
