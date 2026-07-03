import { join } from 'node:path';
import { homedir } from 'node:os';

const QUALIA_HOME = join(homedir(), '.qualia');
const DATA_DIR = join(QUALIA_HOME, 'data');

export function getQualiaHome(): string {
	return QUALIA_HOME;
}

export function getDataDir(): string {
	return DATA_DIR;
}

export function getDataPath(...segments: string[]): string {
	return join(DATA_DIR, ...segments);
}

export function getConfigPath(): string {
	return join(QUALIA_HOME, 'config.json');
}
