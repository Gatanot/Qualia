import { readConfig } from '$lib/config';
import { runSummarizeJob } from './background';
import { BackgroundWorker } from '$lib/concurrency';
import type { GatewayNotification } from '$lib/gateway';

function getToday(): string {
	const d = new Date();
	return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function createSummarizeWorker(
	notify: (notification: GatewayNotification) => Promise<void>
) {
	let worker: BackgroundWorker | null = null;
	let lastScheduledDate = '';

	async function tick(): Promise<void> {
		const config = readConfig();
		if (!config.autoSummarize || !config.storageEnabled) return;

		let result: { summarized: number; diary: boolean } | undefined;

		if (config.summaryMode === 'scheduled') {
			const now = new Date();
			const today = getToday();
			if (now.getHours() >= (config.summaryScheduleHour || 2) && today !== lastScheduledDate) {
				lastScheduledDate = today;
				result = await runSummarizeJob(false, null);
			}
		} else {
			result = await runSummarizeJob();
		}

		if (result) {
			const { summarized, diary } = result;
			if (summarized > 0 || diary) {
				const parts: string[] = [];
				if (summarized > 0) parts.push(`已为 ${summarized} 个对话生成摘要`);
				if (diary) parts.push('已生成日记条目');
				await notify({
					title: 'Qualia 任务完成',
					body: parts.join('\n'),
					type: 'task_complete'
				});
			}
		}
	}

	return {
		start(): void {
			const config = readConfig();
			if (!config.autoSummarize || !config.storageEnabled) return;

			const intervalMin = config.summaryIntervalMin || 30;
			worker = new BackgroundWorker();
			worker.schedule('summarize', intervalMin * 60 * 1000, tick);
			worker.start();

			tick();
		},

		stop(): void {
			if (worker) {
				worker.stop();
				worker = null;
			}
		}
	};
}
