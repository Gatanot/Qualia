import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ToolDef, ToolResult } from '../types.js';
import { getDataPath } from '../../paths.js';
import { stripBom } from './file-utils.js';

const DIARY_DIR = getDataPath('diary');
const MD_SUFFIX = '.md';
const SNIPPET_RADIUS = 80;

/** 校验形如 YYYY-MM-DD 的日期串（字符级，不用正则） */
function isDateString(s: string): boolean {
	if (s.length !== 10) return false;
	for (let i = 0; i < 10; i++) {
		const ch = s[i];
		if (i === 4 || i === 7) {
			if (ch !== '-') return false;
		} else if (ch < '0' || ch > '9') {
			return false;
		}
	}
	return true;
}

/** 列出 diary 目录下所有日记日期，按日期倒序（最新在前） */
async function listDiaryDates(): Promise<string[]> {
	let entries: string[];
	try {
		entries = await readdir(DIARY_DIR);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
		throw error;
	}
	const dates: string[] = [];
	for (const name of entries) {
		if (!name.endsWith(MD_SUFFIX)) continue;
		const date = name.slice(0, name.length - MD_SUFFIX.length);
		if (isDateString(date)) dates.push(date);
	}
	dates.sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
	return dates;
}

async function readDiaryFile(date: string): Promise<string | null> {
	try {
		const raw = await readFile(join(DIARY_DIR, date + MD_SUFFIX), 'utf-8');
		return stripBom(raw).trim();
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
		throw error;
	}
}

/** 把换行折叠为空格（字符级，不用正则） */
function flattenNewlines(text: string): string {
	let out = '';
	for (const ch of text) {
		out += ch === '\n' || ch === '\r' ? ' ' : ch;
	}
	return out;
}

/** 提取关键词命中处的上下文片段 */
function extractSnippet(content: string, queryLower: string): string {
	const idx = content.toLowerCase().indexOf(queryLower);
	if (idx < 0) return '';
	const start = Math.max(0, idx - SNIPPET_RADIUS);
	const end = Math.min(content.length, idx + queryLower.length + SNIPPET_RADIUS);
	const prefix = start > 0 ? '…' : '';
	const suffix = end < content.length ? '…' : '';
	return prefix + flattenNewlines(content.slice(start, end)) + suffix;
}

export const readDiaryTool: ToolDef = {
	name: 'read_diary',
	description: 'Read or search Qualia\'s own diary entries (daily narrative journals auto-written after summarization, stored as ~/.qualia/data/diary/YYYY-MM-DD.md). Pass "date" (YYYY-MM-DD) to read one day\'s entry, "query" to keyword-search across all entries, or neither to list available dates. Use to recall what happened on past days from the assistant\'s own perspective. Note: this is the diary, distinct from chat history (search_history) and long-term memory (read_memory).',
	parameters: {
		type: 'object',
		properties: {
			date: {
				type: 'string',
				description: 'Optional. A specific date in YYYY-MM-DD format to read that day\'s diary entry.'
			},
			query: {
				type: 'string',
				description: 'Optional. Keyword to search across all diary entries (case-insensitive). Returns matching dates with snippets.'
			},
			limit: {
				type: 'number',
				description: 'Optional. Max results for list/search, default 10.'
			}
		},
		required: []
	},

	async execute(args: Record<string, unknown>): Promise<ToolResult> {
		const date = (args.date as string)?.trim();
		const query = (args.query as string)?.trim();
		const limit = (args.limit as number) || 10;

		try {
			if (date) {
				if (!isDateString(date)) {
					return { success: false, output: '', error: `日期格式应为 YYYY-MM-DD，收到: ${date}` };
				}
				const content = await readDiaryFile(date);
				if (content === null || content === '') {
					return { success: true, output: `（${date} 没有日记）` };
				}
				return { success: true, output: `=== ${date} 日记 ===\n${content}` };
			}

			const dates = await listDiaryDates();
			if (dates.length === 0) {
				return { success: true, output: '（暂无日记）' };
			}

			if (query) {
				const queryLower = query.toLowerCase();
				const hits: string[] = [];
				for (const d of dates) {
					if (hits.length >= limit) break;
					const content = await readDiaryFile(d);
					if (content && content.toLowerCase().includes(queryLower)) {
						hits.push(`[${d}] ${extractSnippet(content, queryLower)}`);
					}
				}
				if (hits.length === 0) {
					return { success: true, output: `（没有找到包含 "${query}" 的日记）` };
				}
				return { success: true, output: `找到 ${hits.length} 篇包含 "${query}" 的日记：\n\n${hits.join('\n\n')}` };
			}

			const shown = dates.slice(0, limit);
			const more = dates.length > shown.length ? `\n…共 ${dates.length} 篇，仅列出最近 ${shown.length} 篇` : '';
			return { success: true, output: `现有日记（${dates.length} 篇）：\n${shown.join('\n')}${more}` };
		} catch (error) {
			return { success: false, output: '', error: `读取日记失败: ${(error as Error).message}` };
		}
	}
};
