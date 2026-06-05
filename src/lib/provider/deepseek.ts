import { OpenAIProvider, type OpenAIConfig } from './openai';
import type { ChatRequest } from './types';

export interface DeepSeekConfig extends OpenAIConfig {
	reasoningEffort?: string;
}

export class DeepSeekProvider extends OpenAIProvider {
	private reasoningEffort?: string;

	constructor(config: DeepSeekConfig) {
		super(config);
		this.reasoningEffort = config.reasoningEffort;
	}

	protected buildBodyObject(request: ChatRequest & { stream: boolean }): Record<string, unknown> {
		const body = super.buildBodyObject(request);

		if (this.reasoningEffort) {
			body.thinking = { type: 'enabled' };
			body.reasoning_effort = this.reasoningEffort;
		}

		return body;
	}
}
