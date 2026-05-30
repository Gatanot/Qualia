import { writable } from 'svelte/store';
import type { Session, MessageRecord } from '$lib/storage';

export const sessions = writable<Session[]>([]);
const messages = writable<MessageRecord[]>([]);

export async function loadSessions() {
	const res = await fetch('/api/sessions');
	if (res.ok) {
		sessions.set(await res.json());
	}
}

export async function loadMessages(sessionId: string): Promise<MessageRecord[]> {
	if (!sessionId) { messages.set([]); return []; }
	const res = await fetch('/api/sessions', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ action: 'getMessages', sessionId })
	});
	if (res.ok) {
		const data = await res.json();
		messages.set(data);
		return data;
	} else {
		messages.set([]);
		return [];
	}
}

export async function createSession(): Promise<Session | null> {
	const res = await fetch('/api/sessions', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ action: 'create' })
	});
	if (res.ok) {
		const session = await res.json();
		sessions.update((list) => [session, ...list]);
		return session;
	}
	return null;
}

export async function setSessionTitle(sessionId: string, title: string) {
	await fetch('/api/sessions', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ action: 'setTitle', sessionId, title })
	});
	sessions.update((list) => {
		const s = list.find((s) => s.id === sessionId);
		if (s) s.title = title;
		return list;
	});
}

export async function deleteSession(sessionId: string) {
	await fetch('/api/sessions', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ action: 'delete', sessionId })
	});
	sessions.update((list) => list.filter((s) => s.id !== sessionId));
}

export function bumpSession(sessionId: string) {
	sessions.update((list) => {
		const idx = list.findIndex((s) => s.id === sessionId);
		if (idx > 0) {
			const [s] = list.splice(idx, 1);
			return [s, ...list];
		}
		return list;
	});
}
