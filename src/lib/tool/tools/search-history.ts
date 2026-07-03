import type { Storage, MessageSearchResult } from '$lib/storage';
import type { ToolDef, ToolResult } from '../types';

function formatResults(results: MessageSearchResult[], query: string): string {
	if (results.length === 0) {
		return `（未在历史对话中找到与 "${query}" 相关的内容）`;
	}

	const lines: string[] = [`找到 ${results.length} 条与 "${query}" 相关的结果：`];

	let lastSession = '';
	for (const r of results) {
		if (r.sessionTitle !== lastSession) {
			lastSession = r.sessionTitle;
			lines.push('', `--- ${r.sessionTitle} ---`);
		}
		const date = new Date(r.createdAt).toLocaleString('zh-CN');
		const roleLabel = r.role === 'user' ? '用户' : r.role === 'assistant' ? 'AI' : r.role;
		const snippet = r.content.length > 200 ? r.content.slice(0, 200) + '...' : r.content;
		lines.push(`[${date}] ${roleLabel}: ${snippet}`);
	}

	return lines.join('\n');
}

export function createSearchHistoryTool(storage: Storage): ToolDef {
	return {
		name: 'search_history',
		description: 'Search conversation history across all sessions with fuzzy text matching. Use when you need to recall what the user discussed before. Note: this searches chat records, not long-term memory (use read_memory for that).',
		parameters: {
			type: 'object',
			properties: {
				query: {
					type: 'string',
					description: 'Search keyword or phrase (case-insensitive). Matches content field of all messages.'
				},
				session_id: {
					type: 'string',
					description: 'Optional. Limit search to a specific session. Omit to search all sessions.'
				},
				limit: {
					type: 'number',
					description: 'Optional. Max results, default 10.'
				}
			},
			required: ['query']
		},

		async execute(args: Record<string, unknown>, _ctx: import('../env').ToolContext): Promise<ToolResult> {
			const query = args.query as string;
			const sessionId = args.session_id as string | undefined;
			const limit = (args.limit as number) || 10;

			if (!query?.trim()) {
				return { success: false, output: '', error: 'query 不能为空' };
			}

			try {
				const results = await storage.searchMessages(query.trim(), sessionId || undefined, limit);
				return { success: true, output: formatResults(results, query.trim()) };
			} catch (error) {
				return { success: false, output: '', error: `搜索失败: ${(error as Error).message}` };
			}
		}
	};
}
