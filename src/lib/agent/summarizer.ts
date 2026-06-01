import type { AIProvider, Message } from '$lib/provider';
import type { Storage } from '$lib/storage';
import { readConfig } from '$lib/config';
import { ToolRegistry, readFileTool, writeFileTool, deleteFileTool, execTool } from '$lib/tool';
import { DEFAULT_SYSTEM_PROMPT, TOOL_PROMPT_PREFIX, TOOL_PROMPT_SUFFIX } from './prompts';

const _registry = new ToolRegistry();
_registry.register(readFileTool);
_registry.register(writeFileTool);
_registry.register(deleteFileTool);
_registry.register(execTool);
export const _toolDefs = _registry.getDefinitions();

export function buildSystemMessage(): Message {
	let content = readConfig().systemPrompt || DEFAULT_SYSTEM_PROMPT;
	if (_toolDefs.length > 0) {
		content += TOOL_PROMPT_PREFIX;
		content += _toolDefs
			.map((t) => `- **${t.function.name}**: ${t.function.description}`)
			.join('\n');
		content += TOOL_PROMPT_SUFFIX;
	}
	return { role: 'system', content };
}

export async function generateSummary(
	provider: AIProvider,
	storage: Storage,
	sessionId: string,
	existingSummary?: string
): Promise<string> {
	const records = await storage.getMessages(sessionId);
	if (records.length === 0) return '';

	const messages: Message[] = [buildSystemMessage()];

	for (const r of records) {
		if (r.role === 'system') continue;
		const m: Message = {
			role: r.role,
			content: r.content
		};
		if (r.tool_calls) m.tool_calls = r.tool_calls;
		if (r.tool_call_id) m.tool_call_id = r.tool_call_id;
		if (r.name) m.name = r.name;
		messages.push(m);
	}

	let userInstruction = '请总结以上对话，用中文、简洁，以时间线形式逐条记录关键决策、修改的文件和重要结论。';
	if (existingSummary) {
		userInstruction += `\n\n以下是已有摘要，请在此基础上更新（保留已有信息并追加新内容）：\n${existingSummary}`;
	}

	messages.push({ role: 'user', content: userInstruction });

	const response = await provider.chat({
		messages,
		tools: _toolDefs,
		max_tokens: 2000,
		temperature: 0.3
	});

	if (response.usage) {
		const hit = response.usage.prompt_cache_hit_tokens ?? 0;
		const miss = response.usage.prompt_cache_miss_tokens ?? 0;
		console.log(`[summarize] session=${sessionId} messages=${records.length} hit=${hit} miss=${miss} total_tokens=${response.usage.total_tokens}`);
	}

	return response.content || '';
}
