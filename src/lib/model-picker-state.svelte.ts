import type { AppConfig } from '$lib/config';

export interface ModelInfo {
	id: string;
	name: string;
	providerName: string;
	contextWindow: number;
	supportsReasoning: boolean;
	reasoningEffortValues: string[];
	supportsVision: boolean;
}

export const pickerState = $state<{
	config: AppConfig | null;
	allModels: ModelInfo[];
}>({
	config: null,
	allModels: []
});

export function activeModelDef(): ModelInfo | undefined {
	return pickerState.allModels.find((m) => m.id === pickerState.config?.activeModel);
}

export function reasoningEffort(): string | undefined {
	const cfg = pickerState.config;
	if (!cfg?.activeModel) return undefined;
	const model = activeModelDef();
	if (!model) return undefined;
	const provider = cfg.providers.find((p) => p.name === model.providerName);
	return provider?.reasoningEffort;
}

export function reasoningOptions(): string[] {
	const model = activeModelDef();
	if (!model?.supportsReasoning) return [];
	const values = model.reasoningEffortValues;
	if (values.length > 0) return values;
	return ['enabled'];
}
