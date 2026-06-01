import { readConfig } from '$lib/config';
import { runSummarizeJob } from '$lib/agent/background';

let running = false;

async function runBackgroundTasks() {
	if (running) return;
	running = true;

	try {
		const config = readConfig();
		if (!config.autoSummarize) return;

		await runSummarizeJob();
	} catch {
	} finally {
		running = false;

		const config = readConfig();
		const intervalMin = config.summaryIntervalMin || 30;
		setTimeout(runBackgroundTasks, intervalMin * 60 * 1000);
	}
}

runBackgroundTasks();
