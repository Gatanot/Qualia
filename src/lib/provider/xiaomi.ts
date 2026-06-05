import { OpenAIProvider, type OpenAIConfig } from './openai';
import type { ChatRequest } from './types';

export interface XiaomiConfig extends OpenAIConfig {
	reasoningEffort?: string;
}

export class XiaomiProvider extends OpenAIProvider {
	private reasoningEffort?: string;

	constructor(config: XiaomiConfig) {
		super(config);
		this.reasoningEffort = config.reasoningEffort;
	}

	protected buildBodyObject(request: ChatRequest & { stream: boolean }): Record<string, unknown> {
		const body = super.buildBodyObject(request);

		if (this.reasoningEffort) {
			body.thinking = { type: 'enabled' };
		}

		return body;
	}
}
