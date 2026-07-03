import { existsSync, readFileSync } from 'node:fs';
import type { Message, ImageContent, ContentPart } from '../ai/index.js';
import type { Storage } from '../storage/index.js';
import type { BuildResult } from './types.js';
import {
	DEFAULT_SYSTEM_PROMPT,
	SYSTEM_CONTEXT
} from './prompts.js';
import { getDataPath } from '../paths.js';

const DEFAULT_CONTEXT_WINDOW = 1_048_576;

const MEMORY_PATH = getDataPath('memory.md');

function readMemoryFile(): string {
	try {
		if (existsSync(MEMORY_PATH)) {
			return readFileSync(MEMORY_PATH, 'utf-8').replace(/\r/g, '').trim();
		}
	} catch {
	}
	return '';
}

function formatMemorySection(content: string): string {
	if (!content) return '';
	return `\n\n## 用户信息\n\n以下是关于你和用户的已知信息，请据此调整你的行为：\n\n${content}`;
}

/**
 * ContextBuilder — 上下文构建器
 *
 * 负责拼装发给 LLM 的 messages 数组：
 * 1. 系统提示词（用户自定义 + 环境信息 + memory 快照）
 * 2. 会话历史消息
 * 3. 当前用户输入
 *
 * 工具描述通过 API 的 tools 参数传递，不写入 system prompt 文本。
 * memory 在会话首次构建时从 memory.md 读取并存入 session.memory_snapshot，
 * 后续构建直接使用快照，保证 system 消息稳定。
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

	private async resolveMemory(sessionId: string, storage: Storage): Promise<string> {
		const session = await storage.getSession(sessionId);
		if (session?.memory_snapshot) {
			return session.memory_snapshot;
		}

		const content = readMemoryFile();
		if (session) {
			await storage.setMemorySnapshot(sessionId, content);
		}
		return content;
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

		let systemContent = systemPrompt || DEFAULT_SYSTEM_PROMPT;
		systemContent += SYSTEM_CONTEXT;

		const memoryContent = await this.resolveMemory(sessionId, storage);
		systemContent += formatMemorySection(memoryContent);

		const history = await storage.getMessages(sessionId);
		for (const msg of history) {
			if (msg.role === 'system') {
				systemContent += '\n\n' + (typeof msg.content === 'string' ? msg.content : '');
			}
		}

		messages.push({ role: 'system', content: systemContent });

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
