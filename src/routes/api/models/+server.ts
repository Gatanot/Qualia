import { json } from '@sveltejs/kit';
import { getAllAvailableModels } from '$lib/config';

export function GET() {
	const models = getAllAvailableModels();
	return json(models.map((m) => ({
		id: m.model.id,
		name: m.model.name,
		contextWindow: m.model.contextWindow,
		supportsReasoning: m.model.supportsReasoning,
		reasoningEffortValues: m.model.reasoningEffortValues,
		supportsVision: m.model.supportsVision,
		providerName: m.providerName
	})));
}