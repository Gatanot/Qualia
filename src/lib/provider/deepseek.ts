import { OpenAIProvider, type OpenAIConfig } from './openai';
import type { ChatRequest } from './types';

export interface DeepSeekConfig extends OpenAIConfig {
	thinking?: 'enabled' | 'disabled';
	reasoningEffort?: 'high' | 'max';
}

/**
 * DeepSeekProvider — DeepSeek API 专属实现
 *
 * 继承 OpenAIProvider，在请求体中注入 DeepSeek 特有参数：
 * - thinking: 控制思考模式开关 (enabled / disabled)
 * - reasoning_effort: 控制推理深度 (high / max)
 */
export class DeepSeekProvider extends OpenAIProvider {
	private thinking: 'enabled' | 'disabled';
	private reasoningEffort?: 'high' | 'max';

	constructor(config: DeepSeekConfig) {
		super(config);
		this.thinking = config.thinking ?? 'enabled';
		this.reasoningEffort = config.reasoningEffort;
	}

	protected buildBodyObject(request: ChatRequest & { stream: boolean }): Record<string, unknown> {
		const body = super.buildBodyObject(request);

		body.thinking = { type: this.thinking };

		if (this.reasoningEffort) {
			body.reasoning_effort = this.reasoningEffort;
		}

		return body;
	}
}
