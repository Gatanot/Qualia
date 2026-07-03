import {
	getActiveModel,
	getAllAvailableModels,
	getProviderForModel,
	readConfig,
	type AppConfig,
	type ModelDef,
	type ProviderConfig
} from '@gatanot/qualia_core/config';
import { CliError } from '../errors.js';

export interface RuntimeConfig {
	app: AppConfig;
	model: ModelDef;
	provider: ProviderConfig;
	activeModelId: string;
	contextWindow: number;
	storageEnabled: boolean;
}

export function loadRuntimeConfig(options: {
	modelId?: string;
	storageEnabled?: boolean;
}): RuntimeConfig {
	const app = readConfig();
	const activeModelId = options.modelId || app.activeModel;
	if (!activeModelId) {
		throw new CliError('CONFIG', '未选择模型。请先运行 `qualia model list` 查看可用模型，或在 Web 设置页配置供应商。');
	}

	const model = options.modelId ? findModel(options.modelId) : getActiveModel();
	if (!model) {
		throw new CliError('MODEL', `未找到模型：${activeModelId}`);
	}

	const provider = getProviderForModel(activeModelId);
	if (!provider) {
		throw new CliError('MODEL', `未找到模型 ${activeModelId} 对应的供应商配置。`);
	}

	if (provider.type !== 'ollama' && !provider.apiKey) {
		throw new CliError('CONFIG', `供应商 ${provider.name || provider.type} 未配置 API Key。`);
	}

	return {
		app,
		model,
		provider,
		activeModelId,
		contextWindow: model.contextWindow,
		storageEnabled: options.storageEnabled ?? app.storageEnabled
	};
}

function findModel(modelId: string): ModelDef | undefined {
	const found = getAllAvailableModels().find((item) => item.model.id === modelId);
	if (found) return found.model;
	return undefined;
}

export function parseStorageOverride(value: string | undefined): boolean | undefined {
	if (value === undefined) return undefined;
	if (value === 'on' || value === 'true' || value === '1') return true;
	if (value === 'off' || value === 'false' || value === '0') return false;
	throw new CliError('USAGE', '--storage 只能是 on 或 off');
}
