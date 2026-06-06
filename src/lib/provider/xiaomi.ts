import { OpenAIProvider, type OpenAIConfig } from './openai';
import type { ChatRequest } from './types';

export interface XiaomiConfig extends OpenAIConfig {
	reasoningEffort?: string;
	supportsReasoning?: boolean;
}

export class XiaomiProvider extends OpenAIProvider {
	private reasoningEffort?: string;
	private supportsReasoning: boolean;

	constructor(config: XiaomiConfig) {
		super(config);
		this.reasoningEffort = config.reasoningEffort;
		this.supportsReasoning = config.supportsReasoning || false;
	}

	protected buildBodyObject(request: ChatRequest & { stream: boolean }): Record<string, unknown> {
		const body = super.buildBodyObject(request);

		if (this.supportsReasoning) {
			if (this.reasoningEffort) {
				body.thinking = { type: 'enabled' };
			} else {
				body.thinking = { type: 'disabled' };
			}
		}

		return body;
	}
}
