import { getPendingTasks, updateTaskStatus } from './store';
import { executeTask } from './executor';
import type { GatewayNotification } from '$lib/gateway';

let running = false;
let timerId: ReturnType<typeof setTimeout> | null = null;
let notificationCallback: ((notification: GatewayNotification) => Promise<void>) | null = null;

export function setTaskNotificationHandler(fn: (notification: GatewayNotification) => Promise<void>): void {
	notificationCallback = fn;
}

async function tick(): Promise<void> {
	if (running) return;
	running = true;

	try {
		const pending = getPendingTasks();
		for (const task of pending) {
			executeTask(task, async (result, error) => {
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
	} catch (e) {
		console.error('[task scheduler] tick error:', (e as Error).message);
	} finally {
		running = false;
		timerId = setTimeout(tick, 15_000);
	}
}

export function startScheduler(): void {
	stopScheduler();
	tick();
}

export function stopScheduler(): void {
	if (timerId) {
		clearTimeout(timerId);
		timerId = null;
	}
	running = false;
}
