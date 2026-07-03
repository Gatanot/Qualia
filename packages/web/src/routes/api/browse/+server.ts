import { readdirSync, statSync } from 'node:fs';
import { join, normalize, resolve } from 'node:path';

interface DirEntry {
	name: string;
	isDirectory: boolean;
}

export async function POST({ request }: { request: Request }) {
	const { path = '' } = await request.json().catch(() => ({})) as { path?: string };

	let currentPath: string;
	if (!path) {
		currentPath = process.platform === 'win32'
			? process.cwd().slice(0, 3)  // C:\
			: '/';
	} else {
		currentPath = normalize(path);
		if (currentPath === '.' || !currentPath) {
			currentPath = process.platform === 'win32' ? process.cwd().slice(0, 3) : '/';
		}
	}

	const parent = join(currentPath, '..');
	const entries: DirEntry[] = [];

	try {
		const names = readdirSync(currentPath);
		for (const name of names) {
			if (name.startsWith('.')) continue;
			try {
				const fullPath = join(currentPath, name);
				const st = statSync(fullPath);
				if (st.isDirectory()) {
					entries.push({ name, isDirectory: true });
				}
			} catch { /* skip inaccessible */ }
		}
	} catch {
		return new Response(JSON.stringify({ error: '无法访问该路径', path: currentPath, entries: [], parent }), {
			headers: { 'Content-Type': 'application/json' }
		});
	}

	entries.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));

	return new Response(JSON.stringify({ path: currentPath, entries, parent }), {
		headers: { 'Content-Type': 'application/json' }
	});
}
