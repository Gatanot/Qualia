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
	/** 压缩策略：auto 使用模型上下文窗口、custom 按指定阈值触发 */
	compressionMode: 'auto' | 'custom';
	/** 自定义压缩阈值（token 数），仅 compressionMode='custom' 时生效，默认 256000 */
	compressionThreshold: number;
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
}
