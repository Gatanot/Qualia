import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Message, ImageContent, ContentPart } from '$lib/ai';
import type { Storage } from '$lib/storage';
import type { BuildResult } from './types';
import { DEFAULT_SYSTEM_PROMPT } from './prompts';
import { MemoryService } from '$lib/memory';

const DEFAULT_CONTEXT_WINDOW = 1_048_576;

function readAgentsMd(workspace: string): string {
	const root = workspace || process.cwd();
	const agentsPath = join(root, 'AGENTS.md');
	try {
		if (existsSync(agentsPath)) {
			return readFileSync(agentsPath, 'utf-8').trim();
		}
	} catch { /* ignore */ }
	return '';
}

function formatAgentsSection(content: string): string {
	if (!content) return '';
	return `\n\n## 项目说明\n\n以下是当前工作区的项目说明，来自 AGENTS.md：\n\n${content}`;
}

function formatMemorySection(memories: Array<{ type: string; content: string; confidence: number }>): string {
	if (memories.length === 0) return '';

	const rules = memories.filter((m) => m.type === 'rule');
	const others = memories.filter((m) => m.type !== 'rule');

	let section = '\n\n## 长期记忆\n';

	if (rules.length) {
		section += '\n### 用户长期规则\n';
		for (const m of rules) {
			section += `- [rule, confidence: ${m.confidence.toFixed(1)}] ${m.content}\n`;
		}
	}
	if (others.length) {
		section += '\n### 用户偏好与事实\n';
		for (const m of others) {
			const typeLabel = { fact: '事实', preference: '偏好', event: '事件' }[m.type] || m.type;
			section += `- [${typeLabel}, confidence: ${m.confidence.toFixed(1)}] ${m.content}\n`;
		}
	}

	return section;
}

/**
 * ContextBuilder — 上下文构建器
 *
 * 在每次进入会话时组装完整的消息列表：
 * 1. 系统提示词（DEFAULT_SYSTEM_PROMPT 或用户自定义 + 检索到的长期记忆 + AGENTS.md）
 * 2. 会话历史消息（跳过原始 system 消息）
 * 3. 当前用户输入
 *
 * 长期记忆通过 MemoryService.searchContext 按需检索注入，不再全量注入。
 * workspace 根目录下的 AGENTS.md（如有）自动加载为项目说明。
 */
export class ContextBuilder {
	async build(
		sessionId: string,
		userMessage: string,
		images: ImageContent[],
		storage: Storage,
		contextWindow?: number,
		systemPrompt?: string
	): Promise<BuildResult> {
		const messages = await this.buildMessages(sessionId, userMessage, images, storage, systemPrompt);
		return {
			messages,
			contextWindow: contextWindow || DEFAULT_CONTEXT_WINDOW
		};
	}

	private parseStoredContent(content: string): string | ContentPart[] {
		if (content.startsWith('[')) {
			try {
				return JSON.parse(content) as ContentPart[];
			} catch { /* return as string */ }
		}
		return content;
	}

	private buildUserContent(text: string, images: ImageContent[]): string | ContentPart[] {
		if (images.length === 0) return text;
		const parts: ContentPart[] = [
			{ type: 'text', text },
			...images
		];
		return parts;
	}

	private async buildMessages(
		sessionId: string,
		userMessage: string,
		images: ImageContent[],
		storage: Storage,
		systemPrompt?: string
	): Promise<Message[]> {
		const messages: Message[] = [];

		const session = await storage.getSession(sessionId);
		const workspace = session?.workspace || '';

		const systemContent = systemPrompt || DEFAULT_SYSTEM_PROMPT;

		let fullSystem = systemContent;

		const memoryService = new MemoryService(storage);
		const contextMemories = await memoryService.searchContext({
			query: userMessage
		});
		fullSystem += formatMemorySection(
			contextMemories.map((m) => ({
				type: m.type,
				content: m.content,
				confidence: m.confidence
			}))
		);

		const agentsContent = readAgentsMd(workspace);
		fullSystem += formatAgentsSection(agentsContent);

		messages.push({ role: 'system', content: fullSystem });

		const history = await storage.getMessages(sessionId);
		for (const msg of history) {
			if (msg.role === 'system') continue;

			const m: Message = {
				role: msg.role,
				content: this.parseStoredContent(msg.content)
			};

			if (msg.tool_calls) m.tool_calls = msg.tool_calls;
			if (msg.tool_call_id) m.tool_call_id = msg.tool_call_id;
			if (msg.name) m.name = msg.name;

			messages.push(m);
		}

		messages.push({ role: 'user', content: this.buildUserContent(userMessage, images) });

		return messages;
	}
}
