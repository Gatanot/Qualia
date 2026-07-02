import type { ToolDef, ToolResult } from '../types';
import { getAllTasks, formatTasksForAI } from '$lib/task';

export const readTasksTool: ToolDef = {
	name: 'read_tasks',
	description: '查询定时任务列表和结果。可以查看所有任务（包括等待中、执行中、已完成、失败、暂停），或按状态筛选。AI 不会主动收到任务完成通知，需要手动调用此工具查询。',
	parameters: {
		type: 'object',
		properties: {
			status: {
				type: 'string',
				description: '按状态筛选：pending(等待中)、running(执行中)、completed(已完成)、failed(失败)、paused(暂停)。不提供则返回全部'
			}
		},
		required: []
	},
	execute: async (args): Promise<ToolResult> => {
		const statusFilter = (args.status as string)?.trim();
		let tasks = getAllTasks();

		if (statusFilter) {
			const valid = ['pending', 'running', 'completed', 'failed', 'paused'];
			if (!valid.includes(statusFilter)) {
				return { success: false, output: '', error: `无效的状态值 "${statusFilter}"，可选: ${valid.join(', ')}` };
			}
			tasks = tasks.filter((t) => t.status === statusFilter);
		}

		const output = formatTasksForAI(tasks);
		return { success: true, output };
	}
};
