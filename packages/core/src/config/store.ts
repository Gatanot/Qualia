import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import type { AppConfig, ProviderConfig } from './types.js';
import type { ModelDef } from '../ai/models.js';
import { getDefaultModels } from '../ai/models.js';
import { DEFAULT_SYSTEM_PROMPT } from '../agent/prompts.js';
import { getConfigPath, getDataDir } from '../paths.js';

const DEFAULT_CONTEXT_WINDOW = 1_048_576;

function ensureDataDir(): void {
	const dir = getDataDir();
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

const defaultConfig: AppConfig = {
	providers: [],
	activeModel: '',
	storageEnabled: true,
	systemPrompt: DEFAULT_SYSTEM_PROMPT,
	customBrandIcon: false,
	autoSummarize: true,
	summaryMode: 'idle',
	summaryIdleHours: 8,
	summaryScheduleHour: 2,
	summaryIntervalMin: 30,
	compressionMode: 'auto' as const,
	compressionThreshold: 256_000,
	searchEnabled: false,
	searchProvider: 'searxng',
	searxngURL: 'http://localhost:8080',
	tavilyApiKey: '',
	emailNotifications: false,
	emailSmtpHost: '',
	emailSmtpPort: 465,
	emailSmtpSecure: true,
	emailSmtpUser: '',
	emailSmtpPass: '',
	emailFrom: '',
	emailTo: '',
	telegramEnabled: false,
	telegramBotToken: '',
	telegramAllowedUsers: ''
};

function normalizeProvider(p: Partial<ProviderConfig> & { type?: string }): ProviderConfig {
	return {
		type: (p.type as ProviderConfig['type']) || 'openai',
		name: p.name || '',
		apiKey: p.apiKey || '',
		baseURL: p.baseURL || '',
		reasoningEffort: p.reasoningEffort,
		timeout: p.timeout,
		maxRetries: p.maxRetries,
		ollamaURL: p.ollamaURL || 'http://localhost:11434'
	};
}

export function readConfig(): AppConfig {
	const path = getConfigPath();

	if (!existsSync(path)) {
		return structuredClone(defaultConfig);
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
		summaryIntervalMin: typeof parsed.summaryIntervalMin === 'number' ? parsed.summaryIntervalMin : 30,
		compressionMode: parsed.compressionMode === 'custom' ? 'custom' : 'auto',
		compressionThreshold: typeof parsed.compressionThreshold === 'number' ? parsed.compressionThreshold : 256_000,
		searchEnabled: parsed.searchEnabled === true,
			searchProvider: (parsed.searchProvider === 'searxng' || parsed.searchProvider === 'tavily') ? parsed.searchProvider : 'searxng',
			searxngURL: typeof parsed.searxngURL === 'string' ? parsed.searxngURL : 'http://localhost:8080',
			tavilyApiKey: typeof parsed.tavilyApiKey === 'string' ? parsed.tavilyApiKey : '',
			emailNotifications: parsed.emailNotifications === true,
			emailSmtpHost: typeof parsed.emailSmtpHost === 'string' ? parsed.emailSmtpHost : '',
			emailSmtpPort: typeof parsed.emailSmtpPort === 'number' ? parsed.emailSmtpPort : 465,
			emailSmtpSecure: parsed.emailSmtpSecure !== false,
			emailSmtpUser: typeof parsed.emailSmtpUser === 'string' ? parsed.emailSmtpUser : '',
			emailSmtpPass: typeof parsed.emailSmtpPass === 'string' ? parsed.emailSmtpPass : '',
			emailFrom: typeof parsed.emailFrom === 'string' ? parsed.emailFrom : '',
			emailTo: typeof parsed.emailTo === 'string' ? parsed.emailTo : '',
			telegramEnabled: parsed.telegramEnabled === true,
			telegramBotToken: typeof parsed.telegramBotToken === 'string' ? parsed.telegramBotToken : '',
			telegramAllowedUsers: typeof parsed.telegramAllowedUsers === 'string' ? parsed.telegramAllowedUsers : ''
		};
	} catch {
		return structuredClone(defaultConfig);
	}
}

export function writeConfig(config: AppConfig): void {
	const path = getConfigPath();
	ensureDataDir();

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

	for (const provider of config.providers) {
		const models = getDefaultModels(provider.type);
		if (models.length > 0) {
			const model = models.find((m) => m.id === modelId);
			if (model && !model.supportsReasoning) {
				provider.reasoningEffort = undefined;
			}
		} else if (provider.type === 'ollama') {
			provider.reasoningEffort = undefined;
		}
	}

	writeConfig(config);
	return config;
}

export function setReasoningEffort(value: string | null): AppConfig {
	const config = readConfig();
	const provider = config.providers.find((p) => {
		const models = getDefaultModels(p.type);
		if (models.length > 0) {
			return models.some((m) => m.id === config.activeModel);
		}
		return p.type === 'ollama' && !!config.activeModel;
	});
	if (provider) {
		provider.reasoningEffort = value || undefined;
		writeConfig(config);
	}
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
	const ollama = config.providers.find((p) => p.type === 'ollama');
	if (ollama) return ollama;
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
	if (config.providers.some((p) => p.type === 'ollama')) {
		return {
			id: config.activeModel,
			name: config.activeModel,
			contextWindow: 128_000,
			supportsReasoning: false,
			reasoningEffortValues: [],
			supportsVision: false
		};
	}
	return undefined;
}

export function getContextWindow(): number {
	return getActiveModel()?.contextWindow || DEFAULT_CONTEXT_WINDOW;
}
