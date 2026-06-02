import { readConfig, getActiveProvider } from '$lib/config';
import { createProvider } from '$lib/provider';
import { createStorage } from '$lib/storage';
import { generateSummary } from './summarizer';
import { generateDiary } from './diary';

export interface SummarizeResult {
	summarized: number;
	diary: boolean;
}

export async function runSummarizeJob(force?: boolean, idleMs?: number | null): Promise<SummarizeResult> {
	const config = readConfig();
	if (!config.storageEnabled) {
		throw new Error('对话存储未开启');
	}

	const providerConfig = getActiveProvider();
	if (!providerConfig?.apiKey) {
		throw new Error('未配置活跃的 AI 供应商');
	}

	const provider = createProvider(providerConfig);
	const storage = createStorage({ enabled: true });

	let effectiveIdleMs: number | null;
	if (force) {
		effectiveIdleMs = -1;
	} else if (idleMs !== undefined) {
		effectiveIdleMs = idleMs;
	} else {
		effectiveIdleMs = (config.summaryIdleHours || 8) * 60 * 60 * 1000;
	}

	const staleSessions = await storage.getStaleSessions(effectiveIdleMs);

	let summarized = 0;
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
				summarized++;
			}
		} catch (e) {
			console.error(`[summarize] session=${session.id} failed:`, (e as Error).message);
		}
	}

	let diary = false;
	if (summarized > 0) {
		try {
			await generateDiary(provider, storage);
			diary = true;
		} catch (e) {
			console.error('[diary] failed:', (e as Error).message);
		}
	}

	return { summarized, diary };
}
