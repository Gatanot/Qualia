import type { ToolDef, ToolResult } from '../types';
import { getAllTasks, formatTasksForAI } from '$lib/task';

export const readTasksTool: ToolDef = {
	name: 'read_tasks',
	description: 'Query scheduled task list and results. View all tasks (pending, running, completed, failed, paused) or filter by status. The AI is NOT automatically notified of completions — you must manually call this tool to check.',
	parameters: {
		type: 'object',
		properties: {
			status: {
				type: 'string',
				description: 'Filter by status: pending, running, completed, failed, paused. Omit to return all.'
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
