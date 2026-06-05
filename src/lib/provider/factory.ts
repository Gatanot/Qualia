import type { AIProvider } from './base';
import { OpenAIProvider } from './openai';
import { DeepSeekProvider } from './deepseek';
import { XiaomiProvider } from './xiaomi';
import type { ProviderConfig } from '../config/types';

export function createProvider(config: ProviderConfig): AIProvider {
	switch (config.type) {
		case 'openai':
			return new OpenAIProvider({
				apiKey: config.apiKey,
				baseURL: config.baseURL,
				model: config.activeModel || '',
				timeout: config.timeout,
				maxRetries: config.maxRetries ?? 5
			});
		case 'deepseek':
			return new DeepSeekProvider({
				apiKey: config.apiKey,
				baseURL: config.baseURL,
				model: config.activeModel || '',
				timeout: config.timeout,
				maxRetries: config.maxRetries ?? 5,
				thinking: config.thinking,
				reasoningEffort: config.reasoningEffort as 'high' | 'max' | undefined
			});
		case 'xiaomi':
			return new XiaomiProvider({
				apiKey: config.apiKey,
				baseURL: config.baseURL,
				model: config.activeModel || '',
				timeout: config.timeout,
				maxRetries: config.maxRetries ?? 5,
				thinking: config.thinking
			});
		default:
			throw new Error(`Unsupported provider type: ${config.type}`);
	}
}
