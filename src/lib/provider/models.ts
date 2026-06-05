export interface ModelDef {
	id: string;
	name: string;
	contextWindow: number;
	supportsReasoning: boolean;
	reasoningEffortValues: string[];
	supportsVision: boolean;
}

export const OPENAI_MODELS: ModelDef[] = [
	{
		id: 'gpt-4o',
		name: 'GPT-4o',
		contextWindow: 128_000,
		supportsReasoning: false,
		reasoningEffortValues: [],
		supportsVision: false
	},
	{
		id: 'gpt-4o-mini',
		name: 'GPT-4o Mini',
		contextWindow: 128_000,
		supportsReasoning: false,
		reasoningEffortValues: [],
		supportsVision: false
	}
];

export const DEEPSEEK_MODELS: ModelDef[] = [
	{
		id: 'deepseek-v4-pro',
		name: 'DeepSeek V4 Pro',
		contextWindow: 1_048_576,
		supportsReasoning: true,
		reasoningEffortValues: ['high', 'max'],
		supportsVision: false
	},
	{
		id: 'deepseek-v4-flash',
		name: 'DeepSeek V4 Flash',
		contextWindow: 1_048_576,
		supportsReasoning: true,
		reasoningEffortValues: ['high', 'max'],
		supportsVision: false
	}
];

export const XIAOMI_MODELS: ModelDef[] = [
	{
		id: 'mimo-v2.5',
		name: 'MiMo V2.5',
		contextWindow: 1_048_576,
		supportsReasoning: true,
		reasoningEffortValues: [],
		supportsVision: true
	},
	{
		id: 'mimo-v2.5-pro',
		name: 'MiMo V2.5 Pro',
		contextWindow: 1_048_576,
		supportsReasoning: true,
		reasoningEffortValues: [],
		supportsVision: false
	}
];

export function getDefaultModels(type: string): ModelDef[] {
	switch (type) {
		case 'openai':
			return [...OPENAI_MODELS];
		case 'deepseek':
			return [...DEEPSEEK_MODELS];
		case 'xiaomi':
			return [...XIAOMI_MODELS];
		default:
			return [];
	}
}
