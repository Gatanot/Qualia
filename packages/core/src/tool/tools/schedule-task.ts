import type { ToolDef, ToolResult } from '../types.js';
import type { ToolContext } from '../env.js';
import { createTask } from '../../task/index.js';

export const scheduleTaskTool: ToolDef = {
	name: 'schedule_task',
	description: 'Create a scheduled one-shot task. The task runs automatically at the specified future time (no conversation context) and the user is notified on completion. Before using, run exec to get the current system time to ensure scheduledAt is in the future.',
	parameters: {
		type: 'object',
		properties: {
			name: {
				type: 'string',
				description: 'Task name (short description, e.g. "Data processing")'
			},
			prompt: {
				type: 'string',
				description: 'Task description — this is the sole instruction the model receives when executing in the background with no conversation context. Must be self-contained: what to do, expected output format, any necessary details'
			},
			scheduledAt: {
				type: 'string',
				description: 'ISO 8601 datetime string (e.g. 2026-06-16T14:30:00Z). Must be in the future. Use exec to get current system time first.'
			}
		},
		required: ['name', 'prompt', 'scheduledAt']
	},
	execute: async (args, ctx: ToolContext): Promise<ToolResult> => {
		const name = args.name as string;
		const prompt = args.prompt as string;
		const scheduledAtStr = args.scheduledAt as string;

		if (!name?.trim() || !prompt?.trim() || !scheduledAtStr?.trim()) {
			return { success: false, output: '', error: '参数不完整：name、prompt、scheduledAt 均为必填' };
		}

		const scheduledAt = new Date(scheduledAtStr).getTime();
		if (isNaN(scheduledAt)) {
			return { success: false, output: '', error: `无法解析时间 "${scheduledAtStr}"，请使用 ISO 8601 格式，如 2026-06-16T14:30:00Z` };
		}

		const now = Date.now();
		if (scheduledAt <= now) {
			return { success: false, output: '', error: `计划执行时间 ${scheduledAtStr} 已过期。当前时间是 ${new Date(now).toISOString()}，请设置一个未来的时间` };
		}

		const maxFuture = now + 30 * 24 * 60 * 60 * 1000;
		if (scheduledAt > maxFuture) {
			return { success: false, output: '', error: `计划执行时间不能超过 30 天后` };
		}

		const task = await createTask(name.trim(), prompt.trim(), scheduledAt, ctx.root);
		const formatted = new Date(scheduledAt).toISOString().replace('T', ' ').slice(0, 19);

		return {
			success: true,
			output: `任务已创建:\n- ID: ${task.id.slice(0, 8)}\n- 名称: ${task.name}\n- 计划执行: ${formatted}\n\n任务将在指定时间自动执行，完成后通过 Email 通知你。`
		};
	}
};
