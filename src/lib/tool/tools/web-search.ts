import { readConfig } from '$lib/config';
import type { ToolDef, ToolResult } from '../types';

interface SearchResult {
	title: string;
	url: string;
	snippet: string;
}

async function searchSearXNG(query: string, num: number, baseURL: string): Promise<SearchResult[]> {
	const url = `${baseURL.replace(/\/+$/, '')}/search?format=json&q=${encodeURIComponent(query)}`;
	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`SearXNG returned ${res.status}`);
	}
	const json = await res.json() as { results?: Array<{ title: string; url: string; content: string }> };
	const results = json.results || [];
	return results.slice(0, num).map((r) => ({
		title: r.title,
		url: r.url,
		snippet: r.content || ''
	}));
}

async function searchTavily(query: string, num: number, apiKey: string): Promise<SearchResult[]> {
	const res = await fetch('https://api.tavily.com/search', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
		body: JSON.stringify({ query, max_results: num, include_answer: false })
	});
	if (!res.ok) {
		throw new Error(`Tavily returned ${res.status}`);
	}
	const json = await res.json() as { results?: Array<{ title: string; url: string; content: string }> };
	const results = json.results || [];
	return results.slice(0, num).map((r) => ({
		title: r.title,
		url: r.url,
		snippet: r.content || ''
	}));
}

export const webSearchTool: ToolDef = {
	name: 'web_search',
	description: '在互联网上搜索信息。用于获取最新资讯、查找文档、验证事实等。仅在需要实时信息或外部知识时使用。结果包含标题、URL 和摘要。',
	parameters: {
		type: 'object',
		properties: {
			query: {
				type: 'string',
				description: '搜索关键词或问题，用中文或英文'
			},
			num: {
				type: 'integer',
				description: '返回结果数量，默认 5，最大 10'
			}
		},
		required: ['query']
	},

	async execute(args: Record<string, unknown>, _workspaceRoot: string): Promise<ToolResult> {
		const query = (args.query as string)?.trim();
		if (!query) {
			return { success: false, output: '', error: '缺少参数: query' };
		}

		const num = Math.min(Math.max(
			typeof args.num === 'number' ? args.num : 5,
			1
		), 10);

		const config = readConfig();
		if (!config.searchEnabled) {
			return { success: false, output: '', error: '搜索功能未启用，请在设置中开启' };
		}

		const provider = config.searchProvider || 'searxng';

		try {
			let results: SearchResult[];

			if (provider === 'tavily') {
				if (!config.tavilyApiKey) {
					return { success: false, output: '', error: '未配置 Tavily API Key，请在设置中填写' };
				}
				results = await searchTavily(query, num, config.tavilyApiKey);
			} else {
				const searxngURL = config.searxngURL || 'http://localhost:8080';
				results = await searchSearXNG(query, num, searxngURL);
			}

			if (results.length === 0) {
				return { success: true, output: `未找到与「${query}」相关的结果。` };
			}

			const formatted = results
				.map((r, i) => `${i + 1}. **[${r.title}](${r.url})**\n   ${r.snippet}`)
				.join('\n\n');

			return {
				success: true,
				output: `搜索「${query}」的结果（共 ${results.length} 条）：\n\n${formatted}`
			};
		} catch (error) {
			return { success: false, output: '', error: `搜索失败: ${(error as Error).message}` };
		}
	}
};
