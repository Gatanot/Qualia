import { readConfig, getActiveProvider } from '$lib/config';
import { createProvider } from '$lib/provider';
import { createStorage } from '$lib/storage';
import { generateSummary } from '$lib/agent/summarizer';
import { generateDiary } from '$lib/agent/diary';

const DEFAULT_INTERVAL = 30 * 60 * 1000;
const DEFAULT_IDLE_HOURS = 8;

let running = false;

async function runBackgroundTasks() {
	if (running) return;
	running = true;

	try {
		const config = readConfig();
		if (!config.storageEnabled || !config.autoSummarize) return;

		const providerConfig = getActiveProvider();
		if (!providerConfig?.apiKey) return;

		const provider = createProvider(providerConfig);
		const storage = createStorage({ enabled: true });

		const idleMs = (config.summaryIdleHours || DEFAULT_IDLE_HOURS) * 60 * 60 * 1000;
		const staleSessions = await storage.getStaleSessions(idleMs);

		for (const session of staleSessions) {
			try {
				const summary = await generateSummary(
					provider,
					storage,
					session.id,
					session.summary || undefined
				);
				if (summary) {
					await storage.updateSummary(session.id, summary);
				}
			} catch {
			}
		}

		if (staleSessions.length > 0) {
			try {
				await generateDiary(provider, storage);
			} catch {
			}
		}
	} catch {
	} finally {
		running = false;

		const config = readConfig();
		const interval = (config.summaryIntervalMin || DEFAULT_INTERVAL / 60_000) * 60 * 1000;
		setTimeout(runBackgroundTasks, interval);
	}
}

runBackgroundTasks();
