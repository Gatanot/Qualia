import type { Storage, Session, MessageRecord, MessageQueryOptions } from './types';

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

	async createSession(title?: string): Promise<Session> {
		const id = crypto.randomUUID();
		const now = Date.now();
		const session: Session = {
			id,
			title: title || '',
			created_at: now,
			updated_at: now,
			parent_id: null,
			status: 'active',
			token_count: 0
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

	async forkSession(id: string, summary: string): Promise<Session> {
		const parent = this.sessions.get(id);
		if (!parent) throw new Error(`会话不存在: ${id}`);

		const newSession = await this.createSession(`[分叉] ${parent.title}`);
		newSession.parent_id = id;
		this.sessions.set(newSession.id, newSession);

		if (summary) {
			await this.addMessage(newSession.id, {
				session_id: newSession.id,
				role: 'system',
				content: `【父会话摘要】\n${summary}`
			});
		}
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

	async setAudioPath(messageId: string, path: string): Promise<void> {
		const msg = this.messageById.get(messageId);
		if (msg) msg.audio_path = path;
	}
}
