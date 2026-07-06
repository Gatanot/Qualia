import type { ToolDef, ToolResult } from '../types.js';
import { MemoryService } from '../../memory/index.js';
import { readConfig } from '../../config/index.js';
import { createStorage } from '../../storage/index.js';

export const proposeMemoryTool: ToolDef = {
	name: 'propose_memory',
	description: 'Propose a memory to be saved long-term. Creates a pending candidate that the user can accept or ignore. Use when you want to remember important facts, user preferences, rules, or events. The memory will NOT take effect until the user approves it. Types: fact (stable facts), preference (user preferences/habits), rule (explicit rules to follow), event (important events with time context).',
	parameters: {
		type: 'object',
		properties: {
			type: {
				type: 'string',
				description: 'Memory type: fact, preference, rule, or event',
				enum: ['fact', 'preference', 'rule', 'event']
			},
			content: {
				type: 'string',
				description: 'Natural language content of the memory. Write in Chinese, concise and clear. One memory per call.'
			},
			reason: {
				type: 'string',
				description: 'Why this memory should be remembered. Brief explanation.'
			},
			confidence: {
				type: 'number',
				description: 'Confidence level 0-1. Use 1.0 for confirmed facts, lower for inferences.',
				minimum: 0,
				maximum: 1
			}
		},
		required: ['type', 'content']
	},

	async execute(args: Record<string, unknown>, _ctx: import('../env.js').ToolContext): Promise<ToolResult> {
		const type = args.type as string;
		const content = args.content as string;
		const reason = (args.reason as string) || '';
		const confidence = (args.confidence as number) ?? 1.0;

		const validTypes = ['fact', 'preference', 'rule', 'event'];
		if (!type || !validTypes.includes(type)) {
			return { success: false, output: '', error: `无效的记忆类型: ${type}，可选: ${validTypes.join(', ')}` };
		}
		if (!content?.trim()) {
			return { success: false, output: '', error: 'content 不能为空' };
		}

		try {
			const config = readConfig();
			const storage = createStorage({ enabled: config.storageEnabled });
			const memoryService = new MemoryService(storage);

			const candidate = await memoryService.propose({
				type: type as 'fact' | 'preference' | 'rule' | 'event',
				content: content.trim(),
				reason,
				confidence
			});

			return {
				success: true,
				output: `已创建候选记忆 [${type}]: ${candidate.id}\n内容: ${content.trim()}\n状态: 待用户审核`
			};
		} catch (error) {
			return { success: false, output: '', error: `创建候选记忆失败: ${(error as Error).message}` };
		}
	}
};
