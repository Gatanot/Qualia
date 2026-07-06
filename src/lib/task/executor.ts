import { readConfig, getProviderForModel, getActiveModel, getContextWindow } from '$lib/config';
import { createProvider } from '$lib/ai';
import { createStorage } from '$lib/storage';
import {
	ToolRegistry,
	CORE_TOOLS,
	createSearchHistoryTool
} from '$lib/tool';
import { AgentLoop, AgentLogger } from '$lib/agent';
import type { BuildResult } from '$lib/agent';
import type { ScheduledTask } from './types';
import { updateTaskStatus } from './store';

const TASK_TIMEOUT_MS = 10 * 60 * 1000;

export async function executeTask(task: ScheduledTask, onComplete: (result: string, error?: string) => Promise<void>): Promise<void> {
	const started = await updateTaskStatus(task.id, 'running');
	if (!started) {
		return;
	}

	let result = '';
	let error: string | undefined;

	try {
		const config = readConfig();
		if (!config.activeModel) {
			throw new Error('未选择模型');
		}

		const providerConfig = getProviderForModel(config.activeModel);
		if (!providerConfig) {
			throw new Error('未找到供应商配置');
		}

		const model = getActiveModel();
		const runtimeConfig = { ...providerConfig, activeModel: model?.id || config.activeModel, contextWindow: model?.contextWindow || 1_048_576 };
		const provider = createProvider(runtimeConfig);
		const storage = createStorage({ enabled: false });

		const registry = new ToolRegistry();
		for (const t of CORE_TOOLS) {
			if (t.name !== 'propose_memory') registry.register(t);
		}
		registry.register(createSearchHistoryTool(storage));

		const abortController = new AbortController();
		const timeout = setTimeout(() => abortController.abort(), TASK_TIMEOUT_MS);

		try {
			const systemPrompt = `You are a background automation agent. Execute the task description strictly and output a concise result summary in Chinese.
Do not ask the user any questions. Do not wait for confirmation. Do not create new scheduled tasks.
If an operation requires confirmation, skip it and explain why.`;

			const buildResult: BuildResult = {
				messages: [
					{ role: 'system', content: systemPrompt },
					{ role: 'user', content: task.prompt }
				],
				contextWindow: getContextWindow()
			};

			const agent = new AgentLoop(provider, storage, registry, async () => false, abortController.signal, new AgentLogger(`task-${task.id.slice(0, 8)}`), config.compressionMode, config.compressionThreshold);
			const session = await storage.createSession(undefined, process.cwd());
			const sid = session.id;

			for await (const event of agent.run(sid, task.prompt, buildResult)) {
				if (event.type === 'content') {
					result += event.text;
				} else if (event.type === 'error') {
					error = event.message;
				} else if (event.type === 'retry_exhausted') {
					error = event.message;
				}
			}
		} finally {
			clearTimeout(timeout);
		}

		if (error) {
			await updateTaskStatus(task.id, 'failed', { error });
		} else {
			result = result.trim();
			await updateTaskStatus(task.id, 'completed', { result });
		}

		await onComplete(result, error);
	} catch (e) {
		error = (e as Error).message;
		await updateTaskStatus(task.id, 'failed', { error });
		await onComplete('', error);
	}
}
