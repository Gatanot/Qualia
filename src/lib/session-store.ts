import type { Session, MessageRecord } from '$lib/storage';

let _sessions = $state<Session[]>([]);
let _activeId = $state<string>('');
let _messages = $state<MessageRecord[]>([]);

export const sessionStore = {
	get sessions() { return _sessions; },
	get activeId() { return _activeId; },
	get messages() { return _messages; },

	async load() {
		const res = await fetch('/api/sessions');
		if (res.ok) {
			_sessions = await res.json();
		}
	},

	setActive(id: string) {
		_activeId = id;
	},

	async loadMessages(sessionId: string) {
		if (!sessionId) { _messages = []; return; }
		const res = await fetch('/api/sessions', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'getMessages', sessionId })
		});
		if (res.ok) {
			_messages = await res.json();
		} else {
			_messages = [];
		}
	},

	async create(): Promise<Session | null> {
		const res = await fetch('/api/sessions', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'create' })
		});
		if (res.ok) {
			const session = await res.json();
			_sessions = [session, ..._sessions];
			_activeId = session.id;
			_messages = [];
			return session;
		}
		return null;
	},

	async setTitle(sessionId: string, title: string) {
		await fetch('/api/sessions', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'setTitle', sessionId, title })
		});
		const s = _sessions.find((s) => s.id === sessionId);
		if (s) s.title = title;
	},

	async deleteSession(sessionId: string) {
		await fetch('/api/sessions', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'delete', sessionId })
		});
		_sessions = _sessions.filter((s) => s.id !== sessionId);
		if (_activeId === sessionId) {
			_activeId = _sessions[0]?.id || '';
			_messages = [];
		}
	},

	addMessageToSession(sessionId: string) {
		// bump the session to top of list
		const idx = _sessions.findIndex((s) => s.id === sessionId);
		if (idx > 0) {
			const [s] = _sessions.splice(idx, 1);
			_sessions = [s, ..._sessions];
		}
	}
};
