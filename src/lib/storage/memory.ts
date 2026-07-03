import type { Storage, Session, MessageRecord, MessageQueryOptions, MessageSearchResult } from './types';
import { formatSessionTitle } from './utils';

/**
 * MemoryStorage — 基于内存 Map 的存储实现
 *
 * 所有数据存储在内存中，进程重启后数据丢失。
 * 适用于开发测试或关闭持久化时使用。
 */
export class MemoryStorage implements Storage {
	private sessions = new Map<string, Session>();
	private messages = new Map<string, MessageRecord[]>();
	private messageById = new Map<string, MessageRecord>();
	private seqCounter = new Map<string, number>();

	async createSession(title?: string, memorySnapshot?: string, workspace?: string): Promise<Session> {
		const id = crypto.randomUUID();
		const now = Date.now();
		const today = new Date(now);
		const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
		let count = 0;
		for (const s of this.sessions.values()) {
			if (s.created_at >= startOfDay) count++;
		}
		const effectiveTitle = title || formatSessionTitle(today, count + 1);
		const session: Session = {
			id,
			title: effectiveTitle,
			created_at: now,
			updated_at: now,
			parent_id: null,
			status: 'active',
			token_count: 0,
			summary: '',
			last_summarized_at: null,
			memory_snapshot: memorySnapshot || '',
			workspace: workspace || ''
		};
		this.sessions.set(id, session);
		this.messages.set(id, []);
		this.seqCounter.set(id, 0);
		return session;
	}

	async getSession(id: string): Promise<Session | null> {
		return this.sessions.get(id) || null;
	}

	async listSessions(): Promise<Session[]> {
		return Array.from(this.sessions.values())
			.sort((a, b) => b.updated_at - a.updated_at);
	}

	async deleteSession(id: string): Promise<void> {
		this.sessions.delete(id);
		const msgs = this.messages.get(id) || [];
		for (const msg of msgs) {
			this.messageById.delete(msg.id);
		}
		this.messages.delete(id);
		this.seqCounter.delete(id);
	}

	async archiveSession(id: string): Promise<void> {
		const session = this.sessions.get(id);
		if (session) {
			session.status = 'archived';
			session.updated_at = Date.now();
		}
	}

	async forkSession(id: string): Promise<Session> {
		const parent = this.sessions.get(id);
		if (!parent) throw new Error(`会话不存在: ${id}`);

		const newSession = await this.createSession(`[分叉] ${parent.title}`, parent.memory_snapshot);
		newSession.parent_id = id;
		newSession.token_count = parent.token_count;
		this.sessions.set(newSession.id, newSession);

		// 复制父会话全部消息，保持缓存命中的消息序列一致
		const parentMessages = this.messages.get(id) || [];
		const copiedMsgs: MessageRecord[] = [];
		let seq = 0;
		for (const msg of parentMessages) {
			seq++;
			const copy: MessageRecord = {
				...msg,
				id: crypto.randomUUID(),
				session_id: newSession.id,
				seq
			};
			copiedMsgs.push(copy);
			this.messageById.set(copy.id, copy);
		}
		this.messages.set(newSession.id, copiedMsgs);
		this.seqCounter.set(newSession.id, seq);

		return newSession;
	}

	async addMessage(
		sessionId: string,
		message: Omit<MessageRecord, 'id' | 'created_at' | 'seq'> & { id?: string }
	): Promise<MessageRecord> {
		const session = this.sessions.get(sessionId);
		if (!session) throw new Error(`会话不存在: ${sessionId}`);

		const seq = (this.seqCounter.get(sessionId) || 0) + 1;
		this.seqCounter.set(sessionId, seq);

		const record: MessageRecord = {
			...message,
			id: message.id || crypto.randomUUID(),
			created_at: Date.now(),
			seq
		};

		const list = this.messages.get(sessionId) || [];
		list.push(record);
		this.messages.set(sessionId, list);
		this.messageById.set(record.id, record);
		session.updated_at = Date.now();
		return record;
	}

	async getMessages(
		sessionId: string,
		options?: MessageQueryOptions
	): Promise<MessageRecord[]> {
		let list = this.messages.get(sessionId) || [];
		if (options?.before !== undefined) list = list.filter((m) => m.seq < options.before!);
		if (options?.limit !== undefined) list = list.slice(-options.limit);
		return list;
	}

	async getMessage(id: string): Promise<MessageRecord | null> {
		return this.messageById.get(id) || null;
	}

	async deleteMessage(id: string): Promise<void> {
		const msg = this.messageById.get(id);
		if (!msg) return;
		this.messageById.delete(id);
		const list = this.messages.get(msg.session_id);
		if (list) {
			const idx = list.findIndex((m) => m.id === id);
			if (idx !== -1) list.splice(idx, 1);
		}
	}

	async deleteMessagesFrom(sessionId: string, messageId: string): Promise<void> {
		const list = this.messages.get(sessionId);
		if (!list) return;
		const idx = list.findIndex((m) => m.id === messageId);
		if (idx === -1) return;
		const toDelete = list.splice(idx);
		for (const msg of toDelete) {
			this.messageById.delete(msg.id);
		}
	}

	async getTokenCount(sessionId: string): Promise<number> {
		return this.sessions.get(sessionId)?.token_count || 0;
	}

	async updateTokenCount(sessionId: string, count: number): Promise<void> {
		const session = this.sessions.get(sessionId);
		if (session) session.token_count = count;
	}

	async setSessionTitle(sessionId: string, title: string): Promise<void> {
		const session = this.sessions.get(sessionId);
		if (session) session.title = title;
	}

	async getStaleSessions(idleMs: number | null): Promise<Session[]> {
		const now = Date.now();
		const result: Session[] = [];
		for (const s of this.sessions.values()) {
			if (s.status !== 'active') continue;
			if (idleMs !== null && now - s.updated_at <= idleMs) continue;
			if (s.last_summarized_at !== null && s.last_summarized_at >= s.updated_at) continue;
			const msgs = this.messages.get(s.id);
			if (!msgs || msgs.length === 0) continue;
			result.push(s);
		}
		result.sort((a, b) => a.updated_at - b.updated_at);
		return result;
	}

	async getMessagesSinceSeq(sessionId: string, seq: number): Promise<MessageRecord[]> {
		const list = this.messages.get(sessionId) || [];
		return list.filter((m) => m.seq > seq);
	}

	async updateSummary(sessionId: string, summary: string): Promise<void> {
		const session = this.sessions.get(sessionId);
		if (session) {
			session.summary = summary;
			session.last_summarized_at = Date.now();
		}
	}

	async getTodayUpdatedSessions(): Promise<Session[]> {
		const now = new Date();
		const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
		const endOfDay = startOfDay + 86_400_000;
		const result: Session[] = [];
		for (const s of this.sessions.values()) {
			if (s.summary && s.last_summarized_at && s.last_summarized_at >= startOfDay && s.last_summarized_at < endOfDay) {
				result.push(s);
			}
		}
		result.sort((a, b) => (a.last_summarized_at || 0) - (b.last_summarized_at || 0));
		return result;
	}

	async setMemorySnapshot(sessionId: string, snapshot: string): Promise<void> {
		const session = this.sessions.get(sessionId);
		if (session) {
			session.memory_snapshot = snapshot;
		}
	}

	async searchMessages(query: string, sessionId?: string, limit = 10): Promise<MessageSearchResult[]> {
		const lowerQuery = query.toLowerCase();
		const results: MessageSearchResult[] = [];
		for (const [sid, msgs] of this.messages) {
			if (sessionId && sid !== sessionId) continue;
			const session = this.sessions.get(sid);
			for (const msg of msgs) {
				if (!msg.content.toLowerCase().includes(lowerQuery)) continue;
				results.push({
					sessionId: sid,
					sessionTitle: session?.title || '',
					messageId: msg.id,
					role: msg.role,
					content: msg.content,
					createdAt: msg.created_at
				});
			}
		}
		results.sort((a, b) => b.createdAt - a.createdAt);
		return results.slice(0, limit);
	}

	async setAudioPath(messageId: string, path: string): Promise<void> {
		const msg = this.messageById.get(messageId);
		if (msg) msg.audio_path = path;
	}

	async getMostRecentSession(): Promise<Session | null> {
		for (const s of this.sessions.values()) {
			if (s.status === 'active') return s;
		}
		return null;
	}

	async listWorkspaces(): Promise<string[]> {
		const workspaces = new Set<string>();
		for (const s of this.sessions.values()) {
			if (s.status === 'active' && s.workspace) {
				workspaces.add(s.workspace);
			}
		}
		return Array.from(workspaces).sort();
	}
}
