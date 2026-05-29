export interface ProviderConfig {
	type: string;
	name: string;
	apiKey: string;
	baseURL: string;
	model: string;
	timeout?: number;
	maxRetries?: number;
}

export interface AppConfig {
	providers: ProviderConfig[];
	activeProvider: string;
	storageEnabled: boolean;
}
