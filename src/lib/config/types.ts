import type { ModelDef } from '../provider/models';

export interface ProviderConfig {
	type: 'openai' | 'deepseek';
	name: string;
	apiKey: string;
	baseURL: string;
	/** @deprecated 迁移到 activeModel */
	model?: string;
	activeModel?: string;
	models?: ModelDef[];
	contextWindow?: number;
	thinking?: 'enabled' | 'disabled';
	reasoningEffort?: string;
	timeout?: number;
	maxRetries?: number;
}

export interface AppConfig {
	providers: ProviderConfig[];
	activeProvider: string;
	storageEnabled: boolean;
	systemPrompt: string;
}
