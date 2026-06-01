import { readConfig } from '$lib/config';
import { runSummarizeJob } from '$lib/agent/background';

let running = false;
let lastScheduledDate = '';

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
		const intervalMin = config.summaryIntervalMin || 30;
		setTimeout(runBackgroundTasks, intervalMin * 60 * 1000);
	}
}

runBackgroundTasks();
