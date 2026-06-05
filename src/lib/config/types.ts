export interface ProviderConfig {
	type: 'openai' | 'deepseek' | 'xiaomi';
	name: string;
	apiKey: string;
	baseURL: string;
	activeModel?: string;
	contextWindow?: number;
	thinking?: 'enabled' | 'disabled';
	reasoningEffort?: string;
	timeout?: number;
	maxRetries?: number;
}

export interface AppConfig {
	providers: ProviderConfig[];
	activeModel: string;
	storageEnabled: boolean;
	systemPrompt: string;
	customBrandIcon: boolean;
	autoSummarize: boolean;
	summaryMode: 'idle' | 'scheduled';
	summaryIdleHours: number;
	summaryScheduleHour: number;
	summaryIntervalMin: number;
}
