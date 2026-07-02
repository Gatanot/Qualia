import { json } from '@sveltejs/kit';
import { getAllTasks, pauseTask, resumeTask, deleteTask, formatTasksForAI } from '$lib/task';

export function GET() {
	const tasks = getAllTasks();
	return json({ tasks });
}

export async function POST({ request }: { request: Request }) {
	const body = await request.json();
	const { action, id } = body as { action: string; id: string };

	if (!id) {
		return json({ error: '缺少任务 ID' }, { status: 400 });
	}

	switch (action) {
		case 'pause':
			return json({ success: await pauseTask(id) });
		case 'resume':
			return json({ success: await resumeTask(id) });
		case 'delete':
			return json({ success: await deleteTask(id) });
		default:
			return json({ error: `未知操作: ${action}` }, { status: 400 });
	}
}
