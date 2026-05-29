export interface ModelDef {
	id: string;
	name: string;
	contextWindow: number;
	supportsReasoning: boolean;
	reasoningEffortValues: string[];
}

export const OPENAI_MODELS: ModelDef[] = [
	{
		id: 'gpt-4o',
		name: 'GPT-4o',
		contextWindow: 128_000,
		supportsReasoning: false,
		reasoningEffortValues: []
	},
	{
		id: 'gpt-4o-mini',
		name: 'GPT-4o Mini',
		contextWindow: 128_000,
		supportsReasoning: false,
		reasoningEffortValues: []
	}
];

export const DEEPSEEK_MODELS: ModelDef[] = [
	{
		id: 'deepseek-v4-pro',
		name: 'DeepSeek V4 Pro',
		contextWindow: 128_000,
		supportsReasoning: true,
		reasoningEffortValues: ['high', 'max']
	},
	{
		id: 'deepseek-v4-flash',
		name: 'DeepSeek V4 Flash',
		contextWindow: 128_000,
		supportsReasoning: true,
		reasoningEffortValues: ['high', 'max']
	}
];

export function getDefaultModels(type: string): ModelDef[] {
	switch (type) {
		case 'openai':
			return [...OPENAI_MODELS];
		case 'deepseek':
			return [...DEEPSEEK_MODELS];
		default:
			return [];
	}
}
