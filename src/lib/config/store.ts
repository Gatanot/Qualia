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

/**
 * 读取应用配置
 *
 * 如果配置文件不存在，返回默认配置。
 * 旧配置文件缺少新增字段时，自动回退默认值。
 */
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

/**
 * 持久化配置到 JSON 文件
 *
 * 自动创建 data/ 目录（如果不存在）。
 */
export function writeConfig(config: AppConfig): void {
	const path = getConfigPath();
	const dir = join(path, '..');

	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}

	writeFileSync(path, JSON.stringify(config, null, '\t'), 'utf-8');
}

/**
 * 添加或更新一个供应商配置
 *
 * 同名配置会被覆盖。如果是第一个添加的供应商，自动设为活跃。
 */
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

/**
 * 删除指定名称的供应商配置
 *
 * 如果删除的是活跃供应商，自动切换到第一个可用供应商。
 */
export function removeProvider(name: string): AppConfig {
	const config = readConfig();
	config.providers = config.providers.filter((p) => p.name !== name);

	if (config.activeProvider === name) {
		config.activeProvider = config.providers[0]?.name || '';
	}

	writeConfig(config);
	return config;
}

/**
 * 设置活跃供应商
 *
 * @throws 供应商名称不存在时抛出错误
 */
export function setActiveProvider(name: string): AppConfig {
	const config = readConfig();

	if (!config.providers.some((p) => p.name === name)) {
		throw new Error(`Provider "${name}" not found`);
	}

	config.activeProvider = name;
	writeConfig(config);
	return config;
}

/**
 * 获取当前活跃的供应商配置
 *
 * @returns 活跃供应商配置，无活跃供应商时返回 undefined
 */
export function getActiveProvider(): ProviderConfig | undefined {
	const config = readConfig();
	return config.providers.find((p) => p.name === config.activeProvider);
}
