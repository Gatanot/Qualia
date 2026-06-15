export interface ProviderConfig {
	type: 'openai' | 'deepseek' | 'xiaomi' | 'ollama';
	name: string;
	apiKey: string;
	baseURL: string;
	activeModel?: string;
	contextWindow?: number;
	reasoningEffort?: string;
	timeout?: number;
	maxRetries?: number;
	ollamaURL?: string;
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
	searchEnabled: boolean;
	searchProvider: 'searxng' | 'tavily';
	searxngURL: string;
	tavilyApiKey: string;
	emailNotifications: boolean;
	emailSmtpHost: string;
	emailSmtpPort: number;
	emailSmtpSecure: boolean;
	emailSmtpUser: string;
	emailSmtpPass: string;
	emailFrom: string;
	emailTo: string;
	telegramBotToken: string;
	telegramAllowedUsers: string;
	telegramProxy: string;
}
