import type { AIProvider } from './base';
import { OpenAIProvider } from './openai';
import { DeepSeekProvider } from './deepseek';
import { XiaomiProvider } from './xiaomi';
import { OllamaProvider } from './ollama';
import type { ProviderConfig } from '../config/types';
import { getDefaultModels } from './models';

export function createProvider(config: ProviderConfig): AIProvider {
	const activeModel = config.activeModel || '';
	const modelDefs = getDefaultModels(config.type);
	const modelDef = modelDefs.find((m) => m.id === activeModel);
	const supportsReasoning = modelDef?.supportsReasoning || false;

	switch (config.type) {
		case 'openai':
			return new OpenAIProvider({
				apiKey: config.apiKey,
				baseURL: config.baseURL,
				model: activeModel,
				timeout: config.timeout,
				maxRetries: config.maxRetries ?? 5
			});
		case 'deepseek':
			return new DeepSeekProvider({
				apiKey: config.apiKey,
				baseURL: config.baseURL,
				model: activeModel,
				timeout: config.timeout,
				maxRetries: config.maxRetries ?? 5,
				reasoningEffort: config.reasoningEffort,
				supportsReasoning
			});
		case 'xiaomi':
			return new XiaomiProvider({
				apiKey: config.apiKey,
				baseURL: config.baseURL,
				model: activeModel,
				timeout: config.timeout,
				maxRetries: config.maxRetries ?? 5,
				reasoningEffort: config.reasoningEffort,
				supportsReasoning
			});
		case 'ollama':
			return new OllamaProvider({
				apiKey: config.apiKey,
				baseURL: config.baseURL || '',
				model: activeModel,
				timeout: config.timeout,
				maxRetries: config.maxRetries ?? 3,
				ollamaURL: config.ollamaURL
			});
		default:
			throw new Error(`Unsupported provider type: ${config.type}`);
	}
}
