import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { json } from '@sveltejs/kit';
import { getDataPath } from '$lib/paths';
import { renderMarkdown } from '$lib/markdown';

const DIARY_DIR = getDataPath('diary');

export async function GET({ url }: { url: URL }) {
	const date = url.searchParams.get('date');

	if (date) {
		if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
			return json({ error: '日期格式无效，需要 YYYY-MM-DD' }, { status: 400 });
		}
		const filePath = join(DIARY_DIR, `${date}.md`);
		try {
			const raw = await readFile(filePath, 'utf-8');
			const html = renderMarkdown(raw);
			return json({ date, content: raw, html });
		} catch {
			return json({ error: '该日期没有日记' }, { status: 404 });
		}
	}

	try {
		const files = await readdir(DIARY_DIR);
		const dates = files
			.filter((f) => f.endsWith('.md'))
			.map((f) => f.slice(0, 10))
			.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
			.sort()
			.reverse();
		return json({ dates });
	} catch {
		return json({ dates: [] });
	}
}
