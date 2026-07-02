import { readConfig, writeConfig } from '$lib/config';
import { writeFile, unlink, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { getDataDir, getDataPath } from '$lib/paths';

const ICON_PATH = getDataPath('brand-icon');

export async function GET() {
	try {
		if (!existsSync(ICON_PATH)) {
			return new Response(null, { status: 404 });
		}
		const buffer = await readFile(ICON_PATH);
		return new Response(buffer, {
			headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' }
		});
	} catch {
		return new Response(null, { status: 404 });
	}
}

export async function POST({ request }: { request: Request }) {
	try {
		const formData = await request.formData();
		const file = formData.get('file') as File | null;

		if (!file || !(file instanceof File)) {
			return new Response(JSON.stringify({ error: '未提供图片文件' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		const buffer = Buffer.from(await file.arrayBuffer());

		if (!existsSync(getDataDir())) {
			await mkdir(getDataDir(), { recursive: true });
		}

		await writeFile(ICON_PATH, buffer);

		const config = readConfig();
		config.customBrandIcon = true;
		writeConfig(config);

		return new Response(JSON.stringify({ ok: true, customBrandIcon: true }), {
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (e) {
		return new Response(JSON.stringify({ error: (e as Error).message }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}

export async function DELETE() {
	try {
		if (existsSync(ICON_PATH)) {
			await unlink(ICON_PATH);
		}

		const config = readConfig();
		config.customBrandIcon = false;
		writeConfig(config);

		return new Response(JSON.stringify({ ok: true, customBrandIcon: false }), {
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (e) {
		return new Response(JSON.stringify({ error: (e as Error).message }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}
