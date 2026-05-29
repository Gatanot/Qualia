import { json } from '@sveltejs/kit';
import {
	readConfig,
	writeConfig,
	addProvider,
	removeProvider,
	setActiveProvider
} from '$lib/config';
import type { ProviderConfig } from '$lib/config';

export async function GET() {
	const config = readConfig();
	return json(config);
}

export async function PUT({ request }) {
	try {
		const body = await request.json();

		switch (body.action) {
			case 'addProvider': {
				const provider = body.provider as ProviderConfig;
				if (!provider.name || !provider.apiKey || !provider.baseURL || !provider.model) {
					return json({ error: 'Missing required fields: name, apiKey, baseURL, model' }, { status: 400 });
				}
				const config = addProvider({ ...provider, type: provider.type || 'openai' });
				return json(config);
			}
			case 'removeProvider': {
				const config = removeProvider(body.name as string);
				return json(config);
			}
			case 'setActiveProvider': {
				try {
					const config = setActiveProvider(body.name as string);
					return json(config);
				} catch (e) {
					return json({ error: (e as Error).message }, { status: 400 });
				}
			}
			case 'writeConfig': {
				writeConfig(body.config);
				return json(readConfig());
			}
			default:
				return json({ error: 'Unknown action' }, { status: 400 });
		}
	} catch (e) {
		return json({ error: (e as Error).message }, { status: 500 });
	}
}
