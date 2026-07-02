import { getPendingTasks, updateTaskStatus } from './store';
import { executeTask } from './executor';
import type { GatewayNotification } from '$lib/gateway';
import { BackgroundWorker } from '$lib/concurrency';

const SCAN_INTERVAL_MS = 15_000;

let worker: BackgroundWorker | null = null;
let notificationCallback: ((notification: GatewayNotification) => Promise<void>) | null = null;

export function setTaskNotificationHandler(fn: (notification: GatewayNotification) => Promise<void>): void {
	notificationCallback = fn;
}

async function tick(): Promise<void> {
	const pending = getPendingTasks();
	for (const task of pending) {
		await executeTask(task, async (result, error) => {
			if (notificationCallback) {
				if (error) {
					await notificationCallback({
						title: `任务失败: ${task.name}`,
						body: error,
						type: 'error'
					});
				} else {
					const preview = result.slice(0, 300) + (result.length > 300 ? '...' : '');
					await notificationCallback({
						title: `任务完成: ${task.name}`,
						body: preview,
						type: 'task_complete'
					});
				}
			}
		});
	}
}

export function startScheduler(): void {
	if (worker) return;
	worker = new BackgroundWorker();
	worker.schedule('task-tick', SCAN_INTERVAL_MS, tick);
	worker.start();
}

export function stopScheduler(): void {
	if (worker) {
		worker.stop();
		worker = null;
	}
}
