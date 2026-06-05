import { readConfig } from '$lib/config';
import { runSummarizeJob } from '$lib/agent/background';

let running = false;
let lastScheduledDate = '';
let timerId: ReturnType<typeof setTimeout> | null = null;

function getToday(): string {
	const d = new Date();
	return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

async function runBackgroundTasks() {
	if (running) return;
	running = true;

	try {
		const config = readConfig();
		if (!config.autoSummarize) return;

		if (config.summaryMode === 'scheduled') {
			const now = new Date();
			const today = getToday();
			if (now.getHours() >= (config.summaryScheduleHour || 2) && today !== lastScheduledDate) {
				lastScheduledDate = today;
				await runSummarizeJob(false, null);
			}
		} else {
			await runSummarizeJob();
		}
	} catch {
	} finally {
		running = false;

		const config = readConfig();
		if (config.autoSummarize) {
			const intervalMin = config.summaryIntervalMin || 30;
			timerId = setTimeout(runBackgroundTasks, intervalMin * 60 * 1000);
		}
	}
}

function cleanup() {
	if (timerId) {
		clearTimeout(timerId);
		timerId = null;
	}
	running = false;
}

runBackgroundTasks();

if (import.meta.hot) {
	import.meta.hot.dispose(() => {
		cleanup();
	});
}
