import { OpenAIProvider, type OpenAIConfig } from './openai';
import type { ChatRequest } from './types';

export interface XiaomiConfig extends OpenAIConfig {
	thinking?: 'enabled' | 'disabled';
}

export class XiaomiProvider extends OpenAIProvider {
	private thinking: 'enabled' | 'disabled';

	constructor(config: XiaomiConfig) {
		super(config);
		this.thinking = config.thinking ?? 'enabled';
	}

	protected buildBodyObject(request: ChatRequest & { stream: boolean }): Record<string, unknown> {
		const body = super.buildBodyObject(request);

		body.thinking = { type: this.thinking };

		return body;
	}
}
