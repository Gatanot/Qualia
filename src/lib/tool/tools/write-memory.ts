import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { ToolDef, ToolResult } from '../types';

const MEMORY_PATH = join(process.cwd(), 'data', 'memory.md');
const SECTION_META = `
## 关于我自己 (Qualia)
我是一个运行在本地环境中的 AI 伴侣，帮助用户完成开发工作和日常任务。

## 关于用户
（待记录）

## 重要事件
（待记录）
`;

function ensureMemoryFile(): void {
	if (!existsSync(MEMORY_PATH)) {
		const dir = join(process.cwd(), 'data');
		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true });
		}
		writeFileSync(MEMORY_PATH, SECTION_META.trim() + '\n', 'utf-8');
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
	description: '将重要信息写入长期记忆（memory.md）。仅在发现值得长期记住的内容时使用。信息会自动注入后续新会话的系统提示词。三个类别：self（关于你自己）、user（关于用户）、event（重要事件里程碑）。每次调用会覆盖对应类别的全部内容。',
	parameters: {
		type: 'object',
		properties: {
			category: {
				type: 'string',
				description: '记忆类别：self（关于你自己）、user（关于用户）、event（重要事件）',
				enum: ['self', 'user', 'event']
			},
			content: {
				type: 'string',
				description: '该类别的新内容（会覆盖该类别已有内容）。用中文简明扼要，每条信息独立成行。'
			}
		},
		required: ['category', 'content']
	},

	async execute(args: Record<string, unknown>, _workspaceRoot: string): Promise<ToolResult> {
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
			const current = readFileSync(MEMORY_PATH, 'utf-8');
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
