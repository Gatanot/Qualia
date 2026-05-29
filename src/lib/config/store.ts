import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { AppConfig, ProviderConfig } from './types';
import { DEFAULT_SYSTEM_PROMPT } from '$lib/agent';

function getConfigPath(): string {
	return join(process.cwd(), 'data', 'config.json');
}

const defaultConfig: AppConfig = {
	providers: [],
	activeProvider: '',
	storageEnabled: false,
	systemPrompt: DEFAULT_SYSTEM_PROMPT
};

export function readConfig(): AppConfig {
	const path = getConfigPath();

	if (!existsSync(path)) {
		return { ...defaultConfig };
	}

	try {
		const raw = readFileSync(path, 'utf-8');
		const parsed = JSON.parse(raw) as Partial<AppConfig>;
		return {
			providers: Array.isArray(parsed.providers) ? parsed.providers : [],
			activeProvider: parsed.activeProvider || '',
			storageEnabled: parsed.storageEnabled !== false,
			systemPrompt: parsed.systemPrompt || DEFAULT_SYSTEM_PROMPT
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

	writeFileSync(path, JSON.stringify(config, null, '\t'), 'utf-8');
}

export function addProvider(provider: ProviderConfig): AppConfig {
	const config = readConfig();

	const existing = config.providers.findIndex((p) => p.name === provider.name);
	if (existing !== -1) {
		config.providers[existing] = provider;
	} else {
		config.providers.push(provider);
	}

	if (!config.activeProvider) {
		config.activeProvider = provider.name;
	}

	writeConfig(config);
	return config;
}

export function removeProvider(name: string): AppConfig {
	const config = readConfig();
	config.providers = config.providers.filter((p) => p.name !== name);

	if (config.activeProvider === name) {
		config.activeProvider = config.providers[0]?.name || '';
	}

	writeConfig(config);
	return config;
}

export function setActiveProvider(name: string): AppConfig {
	const config = readConfig();

	if (!config.providers.some((p) => p.name === name)) {
		throw new Error(`Provider "${name}" not found`);
	}

	config.activeProvider = name;
	writeConfig(config);
	return config;
}

export function getActiveProvider(): ProviderConfig | undefined {
	const config = readConfig();
	return config.providers.find((p) => p.name === config.activeProvider);
}
