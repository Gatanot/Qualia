import { OpenAIProvider, type OpenAIConfig } from './openai.js';
import type { ChatRequest } from './types.js';

export interface DeepSeekConfig extends OpenAIConfig {
	reasoningEffort?: string;
	supportsReasoning?: boolean;
}

export class DeepSeekProvider extends OpenAIProvider {
	private reasoningEffort?: string;
	private supportsReasoning: boolean;

	constructor(config: DeepSeekConfig) {
		super(config);
		this.reasoningEffort = config.reasoningEffort;
		this.supportsReasoning = config.supportsReasoning || false;
	}

	protected buildBodyObject(request: ChatRequest & { stream: boolean }): Record<string, unknown> {
		const body = super.buildBodyObject(request);

		if (this.supportsReasoning) {
			if (this.reasoningEffort) {
				body.thinking = { type: 'enabled' };
				body.reasoning_effort = this.reasoningEffort;
			} else {
				body.thinking = { type: 'disabled' };
			}
		}

		return body;
	}
}
