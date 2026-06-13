import type { AIProvider, Message, Usage, ContentPart } from '$lib/ai';
import type { Storage } from '$lib/storage';
import { readConfig } from '$lib/config';
import { ToolRegistry, readFileTool, writeFileTool, deleteFileTool, execTool, writeMemoryTool, webSearchTool } from '$lib/tool';
import { PendingConfirmation } from '$lib/tool';
import { DEFAULT_SYSTEM_PROMPT, SYSTEM_CONTEXT, TOOL_PROMPT_PREFIX, TOOL_PROMPT_SUFFIX } from './prompts';

function parseStoredContent(content: string): string | ContentPart[] {
	if (content.startsWith('[')) {
		try {
			return JSON.parse(content) as ContentPart[];
		} catch { /* return as string */ }
	}
	return content;
}

const _registry = new ToolRegistry();
_registry.register(readFileTool);
_registry.register(writeFileTool);
_registry.register(deleteFileTool);
_registry.register(execTool);
_registry.register(writeMemoryTool);
_registry.register(webSearchTool);
export const _toolDefs = _registry.getDefinitions();

export function buildSystemMessage(): Message {
	let content = readConfig().systemPrompt || DEFAULT_SYSTEM_PROMPT;

	content += SYSTEM_CONTEXT;

	if (_toolDefs.length > 0) {
		content += TOOL_PROMPT_PREFIX;
		content += _toolDefs
			.map((t) => `- **${t.function.name}**: ${t.function.description}`)
			.join('\n');
		content += TOOL_PROMPT_SUFFIX;
	}
	return { role: 'system', content };
}

const MAX_TOOL_ITERATIONS = 10;

export async function completeWithToolLoop(
	provider: AIProvider,
	messages: Message[],
	maxTokens: number,
	temperature: number
): Promise<{ content: string; usage?: Usage }> {
	const tools = _toolDefs;

	for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
		const response = await provider.chat({
			messages,
			tools: tools.length > 0 ? tools : undefined,
			max_tokens: maxTokens,
			temperature
		});

		if (!response.tool_calls || response.tool_calls.length === 0) {
			return { content: response.content || '', usage: response.usage };
		}

		messages.push({
			role: 'assistant',
			content: response.content || '',
			tool_calls: response.tool_calls
		});

		for (const tc of response.tool_calls) {
			let args: Record<string, unknown> = {};
			try { args = JSON.parse(tc.function.arguments); } catch { /* empty */ }

			try {
				const result = await _registry.execute(tc.function.name, args, process.cwd());
				messages.push({
					role: 'tool',
					content: result.output || result.error || '',
					tool_call_id: tc.id,
					name: tc.function.name
				});
			} catch (error) {
				if (error instanceof PendingConfirmation) {
					messages.push({
						role: 'tool',
						content: `后台任务无法执行需确认的操作: ${error.reason}`,
						tool_call_id: tc.id,
						name: error.toolName
					});
				} else {
					const errMsg = (error as Error).message;
					messages.push({
						role: 'tool',
						content: `工具执行异常: ${errMsg}`,
						tool_call_id: tc.id,
						name: tc.function.name
					});
				}
			}
		}
	}

	return { content: '' };
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
			content: parseStoredContent(r.content)
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

	const { content, usage } = await completeWithToolLoop(provider, messages, 2000, 0.3);

	if (usage) {
		const hit = usage.prompt_cache_hit_tokens ?? 0;
		const miss = usage.prompt_cache_miss_tokens ?? 0;
		console.log(`[summarize] session=${sessionId} messages=${records.length} hit=${hit} miss=${miss} total_tokens=${usage.total_tokens}`);
	}

	return content || '';
}
