import { json, text } from '@sveltejs/kit';
import { getThemeData } from '$lib/theme/server-theme';
import { writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export async function GET() {
	const data = getThemeData();
	return json(data);
}

export async function PUT({ request }) {
	try {
		const body = await request.json();
		if (!body?.name || !body?.tokens?.light || !body?.tokens?.dark) {
			return text('Invalid theme: requires name and tokens.{light,dark}', { status: 400 });
		}
		const dir = join(homedir(), '.qualia');
		mkdirSync(dir, { recursive: true });
		writeFileSync(join(dir, 'theme.json'), JSON.stringify(body, null, 2), 'utf8');
		return json({ ok: true });
	} catch (err) {
		return text(String(err), { status: 500 });
	}
}
