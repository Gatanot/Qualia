import type { ToolDef, ToolResult } from '../types';
import { createTask } from '$lib/task';

export const scheduleTaskTool: ToolDef = {
	name: 'schedule_task',
	description: '创建一个定时任务。任务将在指定时间后自动执行（无对话上下文），完成后通过通知渠道告知用户。使用前请先通过 exec 工具获取当前系统时间，确保 scheduledAt 是未来时间。',
	parameters: {
		type: 'object',
		properties: {
			name: {
				type: 'string',
				description: '任务名称（简短描述，如"数据处理"）'
			},
			prompt: {
				type: 'string',
				description: '任务描述——这是任务执行时唯一的指令，必须自包含。即模型在后台执行时没有任何上下文，仅根据这个描述工作。应包含：要做什么、期望的输出格式、任何必要的细节'
			},
			scheduledAt: {
				type: 'string',
				description: 'ISO 8601 时间字符串（如 2026-06-16T14:30:00Z），必须是未来时间。请先通过 exec 工具获取当前系统时间'
			}
		},
		required: ['name', 'prompt', 'scheduledAt']
	},
	execute: async (args): Promise<ToolResult> => {
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

		const task = await createTask(name.trim(), prompt.trim(), scheduledAt);
		const formatted = new Date(scheduledAt).toISOString().replace('T', ' ').slice(0, 19);

		return {
			success: true,
			output: `任务已创建:\n- ID: ${task.id.slice(0, 8)}\n- 名称: ${task.name}\n- 计划执行: ${formatted}\n\n任务将在指定时间自动执行，完成后通过 Email 通知你。`
		};
	}
};
