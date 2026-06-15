import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';

interface BindingStore {
	bindings: Record<string, string>;
}

function getPath(): string {
	return join(process.cwd(), 'data', 'telegram-sessions.json');
}

function readBindings(): BindingStore {
	const path = getPath();
	if (!existsSync(path)) return { bindings: {} };
	try {
		return JSON.parse(readFileSync(path, 'utf-8')) as BindingStore;
	} catch {
		return { bindings: {} };
	}
}

function writeBindings(store: BindingStore): void {
	const path = getPath();
	const dir = join(path, '..');
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
	const tmpPath = path + '.tmp';
	writeFileSync(tmpPath, JSON.stringify(store, null, '\t'), 'utf-8');
	renameSync(tmpPath, path);
}

export function getBoundSession(chatId: string): string | null {
	const store = readBindings();
	return store.bindings[String(chatId)] || null;
}

export function setBoundSession(chatId: string, sessionId: string): void {
	const store = readBindings();
	store.bindings[String(chatId)] = sessionId;
	writeBindings(store);
}

export function getAllChatIds(): string[] {
	const store = readBindings();
	return Object.keys(store.bindings);
}
