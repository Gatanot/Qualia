import Database from 'better-sqlite3';
import type { Storage, Session, MessageRecord, MessageQueryOptions } from './types';
import type { ToolCall, Usage } from '$lib/ai';
import { formatSessionTitle } from './utils';

interface MessageRow {
	id: string;
	session_id: string;
	role: string;
	content: string;
	reasoning_content: string | null;
	tool_calls: string | null;
	tool_call_id: string | null;
	name: string | null;
	usage: string | null;
	audio_path: string | null;
	created_at: number;
	seq: number;
}

interface SessionRow {
	id: string;
	title: string;
	created_at: number;
	updated_at: number;
	parent_id: string | null;
	status: string;
	token_count: number;
	summary: string;
	last_summarized_at: number | null;
	memory_snapshot: string;
}

/**
 * SQLiteStorage — 基于 better-sqlite3 的持久化存储
 *
 * 使用 WAL 模式，支持外键约束。
 * 自动建表，联合索引 (session_id, seq)。
 */
export class SQLiteStorage implements Storage {
	private db: Database.Database;
	private stmts: ReturnType<typeof this.prepareStatements>;

	constructor(dbPath: string) {
		this.db = new Database(dbPath);
		this.db.pragma('journal_mode = WAL');
		this.db.pragma('foreign_keys = ON');
		this.initTables();
		this.stmts = this.prepareStatements();
	}

	private initTables(): void {
		this.db.exec(`
			CREATE TABLE IF NOT EXISTS sessions (
				id          TEXT PRIMARY KEY,
				title       TEXT NOT NULL DEFAULT '',
				created_at  INTEGER NOT NULL,
				updated_at  INTEGER NOT NULL,
				parent_id   TEXT,
				status      TEXT NOT NULL DEFAULT 'active',
				token_count INTEGER NOT NULL DEFAULT 0,
				summary     TEXT NOT NULL DEFAULT '',
				last_summarized_at INTEGER,
				memory_snapshot TEXT NOT NULL DEFAULT ''
			);
			CREATE TABLE IF NOT EXISTS messages (
				id                 TEXT PRIMARY KEY,
				session_id         TEXT NOT NULL,
				role               TEXT NOT NULL,
				content            TEXT NOT NULL DEFAULT '',
				reasoning_content  TEXT,
				tool_calls         TEXT,
				tool_call_id       TEXT,
				name               TEXT,
				usage              TEXT,
				audio_path         TEXT,
				created_at         INTEGER NOT NULL,
				seq                INTEGER NOT NULL,
				FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
			);
			CREATE INDEX IF NOT EXISTS idx_messages_session_seq
				ON messages(session_id, seq);
		`);

		this.migrate();
	}

	private migrate(): void {
		const cols = this.db.pragma('table_info(sessions)') as Array<{ name: string }>;
		const columnNames = new Set(cols.map((c) => c.name));
		if (!columnNames.has('summary')) {
			this.db.exec(`ALTER TABLE sessions ADD COLUMN summary TEXT NOT NULL DEFAULT ''`);
		}
		if (!columnNames.has('last_summarized_at')) {
			this.db.exec(`ALTER TABLE sessions ADD COLUMN last_summarized_at INTEGER`);
		}
		if (!columnNames.has('memory_snapshot')) {
			this.db.exec(`ALTER TABLE sessions ADD COLUMN memory_snapshot TEXT NOT NULL DEFAULT ''`);
		}
	}

	private prepareStatements() {
		return {
			createSession: this.db.prepare(`INSERT INTO sessions (id, title, created_at, updated_at, parent_id, status, token_count, summary, last_summarized_at, memory_snapshot) VALUES (?, ?, ?, ?, ?, ?, ?, '', NULL, ?)`),
			getSession: this.db.prepare(`SELECT * FROM sessions WHERE id = ?`),
			listAllSessions: this.db.prepare(`SELECT * FROM sessions ORDER BY updated_at DESC`),
			deleteSession: this.db.prepare(`DELETE FROM sessions WHERE id = ?`),
			updateSessionStatus: this.db.prepare(`UPDATE sessions SET status = ?, updated_at = ? WHERE id = ?`),
			updateSession: this.db.prepare(`UPDATE sessions SET title = ?, updated_at = ?, token_count = ? WHERE id = ?`),
			insertMessage: this.db.prepare(`INSERT INTO messages (id, session_id, role, content, reasoning_content, tool_calls, tool_call_id, name, usage, audio_path, created_at, seq) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
			getMessages: this.db.prepare(`SELECT * FROM messages WHERE session_id = ? AND (? IS NULL OR seq < ?) ORDER BY seq ASC`),
			getMessagesSinceSeq: this.db.prepare(`SELECT * FROM messages WHERE session_id = ? AND seq > ? ORDER BY seq ASC`),
			getMessage: this.db.prepare(`SELECT * FROM messages WHERE id = ?`),
			deleteMessage: this.db.prepare(`DELETE FROM messages WHERE id = ?`),
			getMaxSeq: this.db.prepare(`SELECT COALESCE(MAX(seq), 0) as max_seq FROM messages WHERE session_id = ?`),
			updateAudioPath: this.db.prepare(`UPDATE messages SET audio_path = ? WHERE id = ?`),
			deleteFromSeq: this.db.prepare(`DELETE FROM messages WHERE session_id = ? AND seq >= ?`),
			setTitle: this.db.prepare(`UPDATE sessions SET title = ? WHERE id = ?`),
			updateSummary: this.db.prepare(`UPDATE sessions SET summary = ?, last_summarized_at = ? WHERE id = ?`),
			getStaleSessions: this.db.prepare(`SELECT * FROM sessions WHERE status = 'active' AND (? - updated_at > ?) AND (last_summarized_at IS NULL OR last_summarized_at < updated_at) AND id IN (SELECT DISTINCT session_id FROM messages) ORDER BY updated_at ASC`),
			getAllUnsummarized: this.db.prepare(`SELECT * FROM sessions WHERE status = 'active' AND (last_summarized_at IS NULL OR last_summarized_at < updated_at) AND id IN (SELECT DISTINCT session_id FROM messages) ORDER BY updated_at ASC`),
			getTodayUpdated: this.db.prepare(`SELECT * FROM sessions WHERE summary != '' AND last_summarized_at >= ? AND last_summarized_at < ? ORDER BY last_summarized_at ASC`),
			setMemorySnapshot: this.db.prepare(`UPDATE sessions SET memory_snapshot = ? WHERE id = ?`),
			countToday: this.db.prepare(`SELECT COUNT(*) as cnt FROM sessions WHERE created_at >= ? AND created_at < ?`)
		};
	}

	async createSession(title?: string, memorySnapshot?: string): Promise<Session> {
		const id = crypto.randomUUID();
		const now = Date.now();
		const effectiveTitle = title || this.generateDefaultTitle(now);
		this.stmts.createSession.run(id, effectiveTitle, now, now, null, 'active', 0, memorySnapshot || '');
		return (await this.getSession(id))!;
	}

	private generateDefaultTitle(now: number): string {
		const today = new Date(now);
		const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
		const endOfDay = startOfDay + 86_400_000;
		const { cnt } = this.stmts.countToday.get(startOfDay, endOfDay) as { cnt: number };
		return formatSessionTitle(today, cnt + 1);
	}

	async getSession(id: string): Promise<Session | null> {
		const row = this.stmts.getSession.get(id) as SessionRow | undefined;
		return row ? this.rowToSession(row) : null;
	}

	async listSessions(): Promise<Session[]> {
		const rows = this.stmts.listAllSessions.all() as SessionRow[];
		return rows.map((row) => this.rowToSession(row));
	}

	async deleteSession(id: string): Promise<void> {
		this.stmts.deleteSession.run(id);
	}

	async archiveSession(id: string): Promise<void> {
		this.stmts.updateSessionStatus.run('archived', Date.now(), id);
	}

	async forkSession(id: string): Promise<Session> {
		const parent = await this.getSession(id);
		if (!parent) throw new Error(`会话不存在: ${id}`);

		const newSession = await this.createSession(`[分叉] ${parent.title}`, parent.memory_snapshot);
		const now = Date.now();

		// 子会话 parent_id 指向父会话
		this.db.prepare('UPDATE sessions SET parent_id = ? WHERE id = ?').run(id, newSession.id);

		// 复制父会话全部消息，保持缓存命中的消息序列一致
		const parentMessages = await this.getMessages(id);
		let seq = 0;
		for (const msg of parentMessages) {
			seq++;
			this.stmts.insertMessage.run(
				crypto.randomUUID(),
				newSession.id,
				msg.role, msg.content,
				msg.reasoning_content || null,
				msg.tool_calls ? JSON.stringify(msg.tool_calls) : null,
				msg.tool_call_id || null,
				msg.name || null,
				msg.usage ? JSON.stringify(msg.usage) : null,
				msg.audio_path || null,
				msg.created_at,
				seq
			);
		}

		// 继承父会话 token_count，反映实际消息量
		this.db.prepare('UPDATE sessions SET token_count = ?, updated_at = ? WHERE id = ?').run(parent.token_count, now, newSession.id);

		return (await this.getSession(newSession.id))!;
	}

	async addMessage(
		sessionId: string,
		message: Omit<MessageRecord, 'id' | 'created_at' | 'seq'> & { id?: string }
	): Promise<MessageRecord> {
		const session = await this.getSession(sessionId);
		if (!session) throw new Error(`会话不存在: ${sessionId}`);

		const { max_seq } = this.stmts.getMaxSeq.get(sessionId) as { max_seq: number };
		const seq = max_seq + 1;
		const id = message.id || crypto.randomUUID();
		const now = Date.now();

		this.stmts.insertMessage.run(
			id, sessionId, message.role, message.content,
			message.reasoning_content || null,
			message.tool_calls ? JSON.stringify(message.tool_calls) : null,
			message.tool_call_id || null,
			message.name || null,
			message.usage ? JSON.stringify(message.usage) : null,
			message.audio_path || null,
			now, seq
		);
		this.stmts.updateSession.run(session.title, now, session.token_count, sessionId);
		return (await this.getMessage(id))!;
	}

	async getMessages(
		sessionId: string,
		options?: MessageQueryOptions
	): Promise<MessageRecord[]> {
		const before = options?.before ?? null;
		const rows = this.stmts.getMessages.all(sessionId, before, before) as MessageRow[];
		let result = rows.map((row) => this.rowToMessage(row));
		if (options?.limit !== undefined) result = result.slice(-options.limit);
		return result;
	}

	async getMessage(id: string): Promise<MessageRecord | null> {
		const row = this.stmts.getMessage.get(id) as MessageRow | undefined;
		return row ? this.rowToMessage(row) : null;
	}

	async deleteMessage(id: string): Promise<void> {
		this.stmts.deleteMessage.run(id);
	}

	async deleteMessagesFrom(sessionId: string, messageId: string): Promise<void> {
		const msg = this.stmts.getMessage.get(messageId) as MessageRow | undefined;
		if (!msg) return;
		this.stmts.deleteFromSeq.run(sessionId, msg.seq);
	}

	async getTokenCount(sessionId: string): Promise<number> {
		const session = await this.getSession(sessionId);
		return session?.token_count || 0;
	}

	async updateTokenCount(sessionId: string, count: number): Promise<void> {
		const session = await this.getSession(sessionId);
		if (session) this.stmts.updateSession.run(session.title, Date.now(), count, sessionId);
	}

	async setSessionTitle(sessionId: string, title: string): Promise<void> {
		this.stmts.setTitle.run(title, sessionId);
	}

	async setAudioPath(messageId: string, path: string): Promise<void> {
		this.stmts.updateAudioPath.run(path, messageId);
	}

	async getStaleSessions(idleMs: number | null): Promise<Session[]> {
		let rows: SessionRow[];
		if (idleMs === null) {
			rows = this.stmts.getAllUnsummarized.all() as SessionRow[];
		} else {
			const now = Date.now();
			rows = this.stmts.getStaleSessions.all(now, idleMs) as SessionRow[];
		}
		return rows.map((row) => this.rowToSession(row));
	}

	async getMessagesSinceSeq(sessionId: string, seq: number): Promise<MessageRecord[]> {
		const rows = this.stmts.getMessagesSinceSeq.all(sessionId, seq) as MessageRow[];
		return rows.map((row) => this.rowToMessage(row));
	}

	async updateSummary(sessionId: string, summary: string): Promise<void> {
		this.stmts.updateSummary.run(summary, Date.now(), sessionId);
	}

	async getTodayUpdatedSessions(): Promise<Session[]> {
		const now = new Date();
		const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
		const endOfDay = startOfDay + 86_400_000;
		const rows = this.stmts.getTodayUpdated.all(startOfDay, endOfDay) as SessionRow[];
		return rows.map((row) => this.rowToSession(row));
	}

	async setMemorySnapshot(sessionId: string, snapshot: string): Promise<void> {
		this.stmts.setMemorySnapshot.run(snapshot, sessionId);
	}

	private rowToSession(row: SessionRow): Session {
		return {
			id: row.id,
			title: row.title,
			created_at: row.created_at,
			updated_at: row.updated_at,
			parent_id: row.parent_id,
			status: row.status as 'active' | 'archived',
			token_count: row.token_count,
			summary: row.summary || '',
			last_summarized_at: row.last_summarized_at ?? null,
			memory_snapshot: row.memory_snapshot || ''
		};
	}

	private rowToMessage(row: MessageRow): MessageRecord {
		return {
			id: row.id,
			session_id: row.session_id,
			role: row.role as MessageRecord['role'],
			content: row.content,
			reasoning_content: row.reasoning_content || undefined,
			tool_calls: row.tool_calls ? (JSON.parse(row.tool_calls) as ToolCall[]) : undefined,
			tool_call_id: row.tool_call_id || undefined,
			name: row.name || undefined,
			usage: row.usage ? (JSON.parse(row.usage) as Usage) : undefined,
			audio_path: row.audio_path || undefined,
			created_at: row.created_at,
			seq: row.seq
		};
	}
}
