import { writeFile, rename, stat, chmod } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname } from 'node:path';

const BOM = '\uFEFF';
export type LineEnding = 'LF' | 'CRLF';

export interface FileMeta {
	bom: boolean;
	lineEnding: LineEnding;
}

export function stripBom(content: string): string {
	if (content.startsWith(BOM)) {
		return content.slice(1);
	}
	return content;
}

export function detectLineEnding(content: string): LineEnding {
	if (content.includes('\r\n')) {
		return 'CRLF';
	}
	return 'LF';
}

export function detectMeta(content: string): FileMeta {
	return {
		bom: content.startsWith(BOM),
		lineEnding: detectLineEnding(content)
	};
}

export function normalizeLineEndings(content: string, target: LineEnding): string {
	if (target === 'CRLF') {
		return content.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
	}
	return content.replace(/\r\n/g, '\n');
}

export function normalizeToLF(content: string): string {
	return content.replace(/\r\n/g, '\n');
}

export function applyMeta(content: string, meta: FileMeta): string {
	let result = normalizeLineEndings(content, meta.lineEnding);
	if (meta.bom && !result.startsWith(BOM)) {
		result = BOM + result;
	} else if (!meta.bom && result.startsWith(BOM)) {
		result = result.slice(1);
	}
	return result;
}

export async function atomicWrite(
	filePath: string,
	content: string,
	meta?: FileMeta
): Promise<void> {
	let finalContent = content;
	let targetMode: number | null = null;

	try {
		const info = await stat(filePath);
		if (info.isFile()) {
			targetMode = info.mode;
		}
	} catch {
		// new file, no mode to preserve
	}

	if (meta) {
		finalContent = applyMeta(content, meta);
	}

	const dir = dirname(filePath);
	const tmpPath = filePath + '.' + randomUUID() + '.tmp';
	await writeFile(tmpPath, finalContent, 'utf-8');

	if (targetMode !== null) {
		await chmod(tmpPath, targetMode);
	}

	await rename(tmpPath, filePath);
}
