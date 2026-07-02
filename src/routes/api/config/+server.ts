import { json } from '@sveltejs/kit';
import {
	readConfig,
	writeConfig,
	addProvider,
	removeProvider,
	setActiveModel,
	setReasoningEffort
} from '$lib/config';
import type { ProviderConfig } from '$lib/config';
import { EmailAdapter } from '$lib/gateway';
import type { EmailConfig } from '$lib/gateway';

export async function GET() {
	const config = readConfig();
	return json(config);
}

export async function PUT({ request }: { request: Request }) {
	try {
		const body = await request.json();

		switch (body.action) {
			case 'addProvider': {
				const provider = body.provider as Record<string, unknown>;
				if (!provider.name || !provider.apiKey || !provider.baseURL) {
					return json({ error: 'Missing required fields: name, apiKey, baseURL' }, { status: 400 });
				}
				const config = addProvider(provider as unknown as ProviderConfig);
				return json(config);
			}
			case 'removeProvider': {
				const config = removeProvider(body.name as string);
				return json(config);
			}
			case 'setActiveModel': {
				const config = setActiveModel(body.modelId as string);
				return json(config);
			}
			case 'setReasoningEffort': {
				const config = setReasoningEffort(body.value as string | null);
				return json(config);
			}
			case 'writeConfig': {
				writeConfig(body.config);
				return json(readConfig());
			}
			case 'testEmail': {
				const raw = body.config as Record<string, unknown>;
				const cfg: EmailConfig = {
					smtpHost: String(raw.smtpHost || ''),
					smtpPort: Number(raw.smtpPort || 465),
					smtpSecure: raw.smtpSecure !== false,
					user: String(raw.user || ''),
					password: String(raw.password || ''),
					from: String(raw.from || ''),
					to: String(raw.to || '')
				};
				if (!cfg.smtpHost || !cfg.user || !cfg.to) {
					return json({ success: false, error: 'SMTP 服务器、账号、收件人不能为空' });
				}
				const adapter = new EmailAdapter(cfg);
				const ok = await adapter.connect();
				await adapter.disconnect();
				return json({ success: ok });
			}
			default:
				return json({ error: 'Unknown action' }, { status: 400 });
		}
	} catch (e) {
		return json({ error: (e as Error).message }, { status: 500 });
	}
}
