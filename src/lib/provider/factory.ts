import type { AIProvider } from './base';
import { OpenAIProvider } from './openai';
import type { ProviderConfig } from '../config/types';

/**
 * 根据配置创建对应的 AI 供应商实例
 *
 * @param config - 供应商配置
 * @returns AIProvider 实例
 * @throws 不支持的供应商类型时抛出错误
 *
 * @example
 * ```ts
 * const ai = createProvider({
 *   type: 'openai',
 *   apiKey: 'sk-xxx',
 *   baseURL: 'https://api.openai.com/v1',
 *   model: 'gpt-4o'
 * });
 * ```
 */
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
