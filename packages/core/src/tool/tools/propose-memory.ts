import type { ToolDef, ToolResult } from '../types.js';
import { PendingConfirmation } from '../types.js';
import { readConfig } from '../../config/index.js';
import { createStorage } from '../../storage/index.js';

const TYPE_LABELS: Record<string, string> = {
	fact: '事实',
	preference: '偏好',
	rule: '规则',
	event: '事件'
};

function toSingleLine(text: string): string {
	let out = '';
	let prevSpace = false;
	for (const ch of text) {
		if (ch === '\n' || ch === '\r' || ch === '\t' || ch === ' ') {
			if (!prevSpace) {
				out += ' ';
				prevSpace = true;
			}
		} else {
			out += ch;
			prevSpace = false;
		}
	}
	return out.trim();
}

export const proposeMemoryTool: ToolDef = {
	name: 'propose_memory',
	description: 'Propose a long-term memory. The user is asked to confirm inline BEFORE anything is written: on approval the memory is stored as active; on rejection nothing is written. If the user rejects, do NOT silently retry the same content — either drop it or negotiate with the user (adjust wording, type, or confidence) and propose again. Use for important facts, user preferences, rules to follow, or notable events. Types: fact (stable facts), preference (user preferences/habits), rule (explicit rules to follow), event (important events with time context).',
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

	async execute(args: Record<string, unknown>, ctx: import('../env.js').ToolContext): Promise<ToolResult> {
		const type = args.type as string;
		const content = (args.content as string) || '';
		const confidence = (args.confidence as number) ?? 1.0;

		const validTypes = ['fact', 'preference', 'rule', 'event'];
		if (!type || !validTypes.includes(type)) {
			return { success: false, output: '', error: `无效的记忆类型: ${type}，可选: ${validTypes.join(', ')}` };
		}
		if (!content.trim()) {
			return { success: false, output: '', error: 'content 不能为空' };
		}

		const trimmed = content.trim();
		const label = TYPE_LABELS[type] || type;

		if (!args.__confirmed) {
			throw new PendingConfirmation(
				'propose_memory',
				args,
				`是否记住这条${label}：${toSingleLine(trimmed)}`,
				`用户拒绝记住该${label}。不要重复提交相同内容；如仍有必要，可与用户沟通调整措辞、类型或置信度后再重新提议，否则放弃记忆。`
			);
		}

		try {
			const config = readConfig();
			const storage = createStorage({ enabled: config.storageEnabled });

			await storage.createMemory({
				type: type as 'fact' | 'preference' | 'rule' | 'event',
				content: trimmed,
				source_session_id: ctx.sessionId ?? null,
				source_kind: 'chat',
				confidence,
				status: 'active',
				priority: type === 'rule' ? 10 : 0,
				tags: []
			});

			return {
				success: true,
				output: `已记住 [${label}]: ${trimmed}`
			};
		} catch (error) {
			return { success: false, output: '', error: `保存记忆失败: ${(error as Error).message}` };
		}
	}
};
