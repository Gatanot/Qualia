import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import type { AppConfig, ProviderConfig } from './types';
import type { ModelDef } from '../provider/models';
import { getDefaultModels } from '../provider/models';
import { DEFAULT_SYSTEM_PROMPT } from '$lib/agent';

const DEFAULT_CONTEXT_WINDOW = 1_048_576;

function getConfigPath(): string {
	return join(process.cwd(), 'data', 'config.json');
}

const defaultConfig: AppConfig = {
	providers: [],
	activeModel: '',
	storageEnabled: false,
	systemPrompt: DEFAULT_SYSTEM_PROMPT,
	customBrandIcon: false,
	autoSummarize: true,
	summaryMode: 'idle',
	summaryIdleHours: 8,
	summaryScheduleHour: 2,
	summaryIntervalMin: 30
};

function normalizeProvider(p: Partial<ProviderConfig> & { type?: string }): ProviderConfig {
	return {
		type: (p.type as ProviderConfig['type']) || 'openai',
		name: p.name || '',
		apiKey: p.apiKey || '',
		baseURL: p.baseURL || '',
		thinking: p.thinking,
		reasoningEffort: p.reasoningEffort,
		timeout: p.timeout,
		maxRetries: p.maxRetries
	};
}

export function readConfig(): AppConfig {
	const path = getConfigPath();

	if (!existsSync(path)) {
		return { ...defaultConfig };
	}

	try {
		const raw = readFileSync(path, 'utf-8');
		const parsed = JSON.parse(raw) as Partial<AppConfig>;
		return {
			providers: Array.isArray(parsed.providers)
				? parsed.providers.map((p) => normalizeProvider(p as Partial<ProviderConfig>))
				: [],
			activeModel: parsed.activeModel || '',
			storageEnabled: parsed.storageEnabled === true,
			systemPrompt: parsed.systemPrompt || DEFAULT_SYSTEM_PROMPT,
			customBrandIcon: parsed.customBrandIcon === true,
			autoSummarize: parsed.autoSummarize !== false,
			summaryMode: parsed.summaryMode === 'scheduled' ? 'scheduled' : 'idle',
			summaryIdleHours: typeof parsed.summaryIdleHours === 'number' ? parsed.summaryIdleHours : 8,
			summaryScheduleHour: typeof parsed.summaryScheduleHour === 'number' ? parsed.summaryScheduleHour : 2,
			summaryIntervalMin: typeof parsed.summaryIntervalMin === 'number' ? parsed.summaryIntervalMin : 30
		};
	} catch {
		return { ...defaultConfig };
	}
}

export function writeConfig(config: AppConfig): void {
	const path = getConfigPath();
	const dir = join(path, '..');

	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}

	const tmpPath = path + '.tmp';
	writeFileSync(tmpPath, JSON.stringify(config, null, '\t'), 'utf-8');
	renameSync(tmpPath, path);
}

export function addProvider(provider: ProviderConfig): AppConfig {
	const config = readConfig();

	const existing = config.providers.findIndex((p) => p.name === provider.name);
	if (existing !== -1) {
		config.providers[existing] = provider;
	} else {
		config.providers.push(provider);
	}

	if (!config.activeModel) {
		const models = getDefaultModels(provider.type);
		config.activeModel = models[0]?.id || '';
	}

	writeConfig(config);
	return config;
}

export function removeProvider(name: string): AppConfig {
	const config = readConfig();
	config.providers = config.providers.filter((p) => p.name !== name);

	const provider = getProviderForModel(config.activeModel);
	if (!provider) {
		const first = config.providers[0];
		config.activeModel = first ? (getDefaultModels(first.type)[0]?.id || '') : '';
	}

	writeConfig(config);
	return config;
}

export function setActiveModel(modelId: string): AppConfig {
	const config = readConfig();
	config.activeModel = modelId;
	writeConfig(config);
	return config;
}

export function getProviderForModel(modelId: string): ProviderConfig | undefined {
	const config = readConfig();
	for (const provider of config.providers) {
		const models = getDefaultModels(provider.type);
		if (models.some((m) => m.id === modelId)) {
			return provider;
		}
	}
	return undefined;
}

export function getAllAvailableModels(): { model: ModelDef; providerName: string }[] {
	const config = readConfig();
	const result: { model: ModelDef; providerName: string }[] = [];
	for (const provider of config.providers) {
		for (const model of getDefaultModels(provider.type)) {
			result.push({ model, providerName: provider.name });
		}
	}
	return result;
}

export function getFirstProvider(): ProviderConfig | undefined {
	return readConfig().providers.find((p) => p.apiKey);
}

export function getActiveModel(): ModelDef | undefined {
	const config = readConfig();
	if (!config.activeModel) return undefined;
	for (const provider of config.providers) {
		const models = getDefaultModels(provider.type);
		const model = models.find((m) => m.id === config.activeModel);
		if (model) return model;
	}
	return undefined;
}

export function getContextWindow(): number {
	return getActiveModel()?.contextWindow || DEFAULT_CONTEXT_WINDOW;
}
