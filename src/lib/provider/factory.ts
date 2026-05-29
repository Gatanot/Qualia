import type { AIProvider } from './base';
import { OpenAIProvider } from './openai';
import type { ProviderConfig } from '../config/types';

export function createProvider(config: ProviderConfig): AIProvider {
	switch (config.type) {
		case 'openai':
			return new OpenAIProvider({
				apiKey: config.apiKey,
				baseURL: config.baseURL,
				model: config.model,
				timeout: config.timeout,
				maxRetries: config.maxRetries
			});
		default:
			throw new Error(`Unsupported provider type: ${config.type}`);
	}
}
