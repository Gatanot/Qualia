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
		description: '搜索历史对话内容。在之前的所有会话中全文模糊匹配消息内容。当你需要回忆用户之前说过什么、讨论过什么话题时使用。注意：此工具搜索的是对话记录，而非长期记忆（使用 read_memory 查看长期记忆）。',
		parameters: {
			type: 'object',
			properties: {
				query: {
					type: 'string',
					description: '搜索关键词或短语（大小写不敏感）。会匹配所有消息的 content 字段。'
				},
				session_id: {
					type: 'string',
					description: '可选。限定在指定会话内搜索。不传则搜索所有会话。'
				},
				limit: {
					type: 'number',
					description: '可选。返回结果的最大条数，默认 10。'
				}
			},
			required: ['query']
		},

		async execute(args: Record<string, unknown>, _workspaceRoot: string): Promise<ToolResult> {
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
