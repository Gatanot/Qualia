import { json } from '@sveltejs/kit';
import {
	readConfig,
	writeConfig,
	addProvider,
	removeProvider,
	setActiveModel,
	setReasoningEffort
} from '$lib/config';
import type { ProviderConfig, AppConfig } from '$lib/config';
import { EmailAdapter } from '$lib/gateway';
import type { EmailConfig } from '$lib/gateway';

function isRecord(v: unknown): v is Record<string, unknown> {
	return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function validateConfig(raw: unknown): raw is Partial<AppConfig> {
	if (!isRecord(raw)) return false;
	if ('providers' in raw && !Array.isArray(raw.providers)) return false;
	if ('activeModel' in raw && typeof raw.activeModel !== 'string') return false;
	if ('storageEnabled' in raw && typeof raw.storageEnabled !== 'boolean') return false;
	if ('systemPrompt' in raw && typeof raw.systemPrompt !== 'string') return false;
	return true;
}

export async function GET() {
	const config = readConfig();
	return json(config);
}

export async function POST({ request }: { request: Request }) {
	try {
		const body = await request.json();
		const { action, config } = body as { action: string; config?: Partial<AppConfig> };

		if (action !== 'importConfig') {
			return json({ error: 'Unsupported action' }, { status: 400 });
		}

		if (!config || !validateConfig(config)) {
			return json({ error: '无效的配置文件格式' }, { status: 400 });
		}

		const existing = readConfig();

		if (config.providers) {
			for (const p of config.providers) {
				if (!p.name || !p.type) continue;
				const idx = existing.providers.findIndex((ep) => ep.name === p.name);
				if (idx !== -1) {
					existing.providers[idx] = { ...existing.providers[idx], ...p };
				} else {
					existing.providers.push(p as ProviderConfig);
				}
			}
		}

		const topLevelKeys: (keyof AppConfig)[] = [
			'activeModel', 'storageEnabled', 'systemPrompt', 'customBrandIcon',
			'autoSummarize', 'summaryMode', 'summaryIdleHours', 'summaryScheduleHour', 'summaryIntervalMin',
			'compressionMode', 'compressionThreshold',
			'searchEnabled', 'searchProvider', 'searxngURL', 'tavilyApiKey',
			'emailNotifications', 'emailSmtpHost', 'emailSmtpPort', 'emailSmtpSecure',
			'emailSmtpUser', 'emailSmtpPass', 'emailFrom', 'emailTo',
			'telegramEnabled', 'telegramBotToken', 'telegramAllowedUsers',
			'defaultWorkspace'
		];

		for (const key of topLevelKeys) {
			if (key in config) {
				(existing as unknown as Record<string, unknown>)[key] = config[key];
			}
		}

		writeConfig(existing);
		return json({ success: true });
	} catch (e) {
		return json({ error: (e as Error).message }, { status: 500 });
	}
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
