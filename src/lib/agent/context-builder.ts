import type { Message } from '$lib/provider';
import type { Storage } from '$lib/storage';
import type { ToolRegistry } from '$lib/tool';
import type { ProviderConfig } from '$lib/config';
import type { BuildResult } from './types';
import {
	DEFAULT_SYSTEM_PROMPT,
	TOOL_PROMPT_PREFIX,
	TOOL_PROMPT_SUFFIX
} from './prompts';

const DEFAULT_CONTEXT_WINDOW = 128_000;
const FORK_THRESHOLD = 20_000;

export class ContextBuilder {
	async build(
		sessionId: string,
		userMessage: string,
		storage: Storage,
		registry: ToolRegistry,
		providerConfig: ProviderConfig,
		systemPrompt?: string
	): Promise<BuildResult> {
		const contextWindow = providerConfig.contextWindow || DEFAULT_CONTEXT_WINDOW;
		const sessionTokenCount = await storage.getTokenCount(sessionId);
		const remaining = contextWindow - sessionTokenCount;

		// 窗口不足，触发分叉
		if (remaining < FORK_THRESHOLD) {
			return this.handleFork(sessionId, userMessage, storage, registry, providerConfig, systemPrompt);
		}

		// 正常构建
		const messages = await this.buildMessages(sessionId, userMessage, storage, registry, systemPrompt);
		return { messages };
	}

	private async handleFork(
		sessionId: string,
		userMessage: string,
		storage: Storage,
		registry: ToolRegistry,
		providerConfig: ProviderConfig,
		systemPrompt?: string
	): Promise<BuildResult> {
		// TODO: 实现 LLM 总结旧对话
		const summary = `（历史对话总结功能尚未实现，来自会话 ${sessionId}）`;

		const newSession = await storage.forkSession(sessionId, summary);

		const messages = await this.buildMessages(
			newSession.id,
			userMessage,
			storage,
			registry,
			systemPrompt
		);

		return {
			messages,
			forked: { newSessionId: newSession.id, summary }
		};
	}

	private async buildMessages(
		sessionId: string,
		userMessage: string,
		storage: Storage,
		registry: ToolRegistry,
		systemPrompt?: string
	): Promise<Message[]> {
		const messages: Message[] = [];

		// 1. System prompt
		const tools = registry.getDefinitions();
		let systemContent = systemPrompt || DEFAULT_SYSTEM_PROMPT;

		if (tools.length > 0) {
			systemContent += TOOL_PROMPT_PREFIX;
			systemContent += tools
				.map((t) => `- **${t.function.name}**: ${t.function.description}`)
				.join('\n');
			systemContent += TOOL_PROMPT_SUFFIX;
		}

		messages.push({ role: 'system', content: systemContent });

		// 2. History
		const history = await storage.getMessages(sessionId, { limit: 50 });
		for (const msg of history) {
			const m: Message = {
				role: msg.role,
				content: msg.content
			};

			if (msg.tool_calls) {
				m.tool_calls = msg.tool_calls;
			}
			if (msg.tool_call_id) {
				m.tool_call_id = msg.tool_call_id;
			}
			if (msg.name) {
				m.name = msg.name;
			}

			messages.push(m);
		}

		// 3. Current user message
		messages.push({ role: 'user', content: userMessage });

		return messages;
	}
}
