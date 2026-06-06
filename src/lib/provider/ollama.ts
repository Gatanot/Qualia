import { OpenAIProvider, type OpenAIConfig } from './openai';

export interface OllamaConfig extends OpenAIConfig {
	ollamaURL?: string;
}

export class OllamaProvider extends OpenAIProvider {
	private ollamaURL: string;

	constructor(config: OllamaConfig) {
		const baseURL = config.baseURL || `${config.ollamaURL || 'http://localhost:11434'}/v1`;
		const normalizedBase = baseURL.endsWith('/v1') ? baseURL : baseURL.replace(/\/+$/, '') + '/v1';
		super({
			apiKey: config.apiKey || 'ollama',
			baseURL: normalizedBase,
			model: config.model,
			timeout: config.timeout,
			maxRetries: config.maxRetries
		});
		this.ollamaURL = config.ollamaURL || 'http://localhost:11434';
	}

	async listModels(): Promise<Array<{ id: string; name: string }>> {
		try {
			const res = await fetch(`${this.ollamaURL}/api/tags`);
			if (!res.ok) return [];
			const json = await res.json() as { models?: Array<{ name: string; details?: { parameter_size?: string; family?: string } }> };
			return (json.models || []).map((m) => ({
				id: m.name,
				name: m.name
			}));
		} catch {
			return [];
		}
	}
}
