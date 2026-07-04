import path from 'node:path';
import { existsSync, statSync } from 'node:fs';
import { CliError } from '../errors.js';

export function resolveWorkspace(input: string | undefined, cwd: string): string {
	const resolved = path.resolve(cwd, input || '.');
	if (!existsSync(resolved)) {
		throw new CliError('IO', `工作区不存在：${resolved}`);
	}
	const stat = statSync(resolved);
	if (!stat.isDirectory()) {
		throw new CliError('IO', `工作区不是目录：${resolved}`);
	}
	return resolved;
}
