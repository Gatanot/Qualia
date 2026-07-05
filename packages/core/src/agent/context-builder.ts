import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Message, ImageContent, ContentPart } from '../ai/index.js';
import type { Storage } from '../storage/index.js';
import type { BuildResult } from './types.js';
import { DEFAULT_SYSTEM_PROMPT } from './prompts.js';
import { getDataPath } from '../paths.js';

const DEFAULT_CONTEXT_WINDOW = 1_048_576;

const MEMORY_PATH = getDataPath('memory.md');

function readMemoryMd(): string {
	try {
		if (existsSync(MEMORY_PATH)) {
			return readFileSync(MEMORY_PATH, 'utf-8').replace(/\r/g, '').trim();
		}
	} catch { /* ignore */ }
	return '';
}

function formatMemorySection(content: string): string {
	if (!content) return '';
	return `\n\n## 用户信息\n\n以下是关于你和用户的已知信息，请据此调整你的行为：\n\n${content}`;
}

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

/**
 * ContextBuilder — 上下文构建器
 *
 * 在每次进入会话时组装完整的消息列表：
 * 1. 系统提示词（DEFAULT_SYSTEM_PROMPT 或用户自定义 + memory.md + AGENTS.md）
 * 2. 会话历史消息（跳过原始 system 消息）
 * 3. 当前用户输入
 *
 * memory.md 在每次构建时重新读取，不在会话中途缓存。
 * workspace 根目录下的 AGENTS.md（如有）自动加载为项目说明。
 * 工具描述通过 API 的 tools 参数传递，不写入系统提示词。
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

		let systemContent = systemPrompt || DEFAULT_SYSTEM_PROMPT;

		const memoryContent = readMemoryMd();
		systemContent += formatMemorySection(memoryContent);

		const agentsContent = readAgentsMd(workspace);
		systemContent += formatAgentsSection(agentsContent);

		messages.push({ role: 'system', content: systemContent });

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
