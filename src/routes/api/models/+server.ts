import { json } from '@sveltejs/kit';
import { getAllAvailableModels, readConfig } from '$lib/config';

export async function GET() {
	const config = readConfig();
	const models = getAllAvailableModels();

	for (const provider of config.providers) {
		if (provider.type === 'ollama') {
			const ollamaURL = provider.ollamaURL || 'http://localhost:11434';
			try {
				const res = await fetch(`${ollamaURL}/api/tags`);
				if (res.ok) {
					const data = await res.json() as { models?: Array<{ name: string }> };
					for (const m of (data.models || [])) {
						models.push({
							model: {
								id: m.name,
								name: m.name,
								contextWindow: 128_000,
								supportsReasoning: false,
								reasoningEffortValues: [],
								supportsVision: false
							},
							providerName: provider.name
						});
					}
				}
			} catch { /* ollama not running */ }
		}
	}

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