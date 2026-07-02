import { readConfig, getProviderForModel, getActiveModel, getContextWindow } from '$lib/config';
import { createProvider } from '$lib/ai';
import { createStorage } from '$lib/storage';
import {
	ToolRegistry,
	CORE_TOOLS,
	createSearchHistoryTool
} from '$lib/tool';
import { AgentLoop } from '$lib/agent';
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
			if (t.name !== 'write_memory') registry.register(t);
		}
		registry.register(createSearchHistoryTool(storage));

		const abortController = new AbortController();
		const timeout = setTimeout(() => abortController.abort(), TASK_TIMEOUT_MS);

		try {
			const systemPrompt = `你是一个后台自动化任务执行 Agent。请严格按照任务描述执行，完成后输出简洁的结果摘要。
不要询问用户任何问题，不要等待确认，不要创建新的定时任务。
如果某个操作需要确认，直接跳过并说明原因。`;

			const buildResult: BuildResult = {
				messages: [
					{ role: 'system', content: systemPrompt },
					{ role: 'user', content: task.prompt }
				],
				contextWindow: getContextWindow()
			};

			const agent = new AgentLoop(provider, storage, registry, async () => false, abortController.signal);
			const sid = `task-${task.id.slice(0, 8)}`;

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
