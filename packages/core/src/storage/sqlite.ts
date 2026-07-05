import Database from 'better-sqlite3';
import type { Storage, Session, MessageRecord, MessageQueryOptions, MessageSearchResult, AuditLogEntry } from './types.js';
import type { ToolCall, Usage } from '../ai/index.js';
import { formatSessionTitle } from './utils.js';

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

interface AuditLogRow {
	id: string;
	session_id: string;
	tool_name: string;
	args: string;
	confirmed: number;
	success: number;
	output: string;
	workspace: string;
	created_at: number;
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
	workspace: string;
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
			workspace   TEXT NOT NULL DEFAULT ''
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
			CREATE TABLE IF NOT EXISTS audit_logs (
				id          TEXT PRIMARY KEY,
				session_id  TEXT NOT NULL,
				tool_name   TEXT NOT NULL,
				args        TEXT NOT NULL DEFAULT '{}',
				confirmed   INTEGER NOT NULL DEFAULT 0,
				success     INTEGER NOT NULL DEFAULT 0,
				output      TEXT NOT NULL DEFAULT '',
				workspace   TEXT NOT NULL DEFAULT '',
				created_at  INTEGER NOT NULL,
				FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
			);
			CREATE INDEX IF NOT EXISTS idx_audit_logs_session
				ON audit_logs(session_id);
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
		if (!columnNames.has('workspace')) {
			this.db.exec(`ALTER TABLE sessions ADD COLUMN workspace TEXT NOT NULL DEFAULT ''`);
		}
	}

	private prepareStatements() {
		return {
			createSession: this.db.prepare(`INSERT INTO sessions (id, title, created_at, updated_at, parent_id, status, token_count, summary, last_summarized_at, workspace) VALUES (?, ?, ?, ?, ?, ?, ?, '', NULL, ?)`),
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
			touchSession: this.db.prepare(`UPDATE sessions SET updated_at = ? WHERE id = ?`),
			getStaleSessions: this.db.prepare(`SELECT * FROM sessions WHERE status = 'active' AND (? - updated_at > ?) AND (last_summarized_at IS NULL OR last_summarized_at < updated_at) AND id IN (SELECT DISTINCT session_id FROM messages) ORDER BY updated_at ASC`),
			getAllUnsummarized: this.db.prepare(`SELECT * FROM sessions WHERE status = 'active' AND (last_summarized_at IS NULL OR last_summarized_at < updated_at) AND id IN (SELECT DISTINCT session_id FROM messages) ORDER BY updated_at ASC`),
			getTodayUpdated: this.db.prepare(`SELECT * FROM sessions WHERE summary != '' AND last_summarized_at >= ? AND last_summarized_at < ? ORDER BY last_summarized_at ASC`),
			countToday: this.db.prepare(`SELECT COUNT(*) as cnt FROM sessions WHERE created_at >= ? AND created_at < ?`),
			searchMessages: this.db.prepare(`SELECT m.id as messageId, m.session_id as sessionId, m.role, m.content, m.created_at as createdAt, s.title as sessionTitle FROM messages m JOIN sessions s ON m.session_id = s.id WHERE m.content LIKE ? AND (? IS NULL OR m.session_id = ?) ORDER BY m.created_at DESC LIMIT ?`),
			insertAuditLog: this.db.prepare(`INSERT INTO audit_logs (id, session_id, tool_name, args, confirmed, success, output, workspace, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`),
			listAuditLogs: this.db.prepare(`SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?`),
		};
	}

	async createSession(title?: string, workspace?: string): Promise<Session> {
		const id = crypto.randomUUID();
		const now = Date.now();
		const effectiveTitle = title || this.generateDefaultTitle(now);
		this.stmts.createSession.run(id, effectiveTitle, now, now, null, 'active', 0, workspace || '');
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

		const newSession = await this.createSession(`[分叉] ${parent.title}`, parent.workspace);
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
		this.stmts.touchSession.run(now, sessionId);
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

	async searchMessages(query: string, sessionId?: string, limit = 10): Promise<MessageSearchResult[]> {
		const pattern = `%${query}%`;
		const rows = this.stmts.searchMessages.all(pattern, sessionId || null, sessionId || null, limit) as Array<{
			messageId: string; sessionId: string; role: string; content: string;
			createdAt: number; sessionTitle: string;
		}>;
		return rows.map((r) => ({
			sessionId: r.sessionId,
			sessionTitle: r.sessionTitle,
			messageId: r.messageId,
			role: r.role as MessageSearchResult['role'],
			content: r.content,
			createdAt: r.createdAt
		}));
	}

	async setAudioPath(messageId: string, path: string): Promise<void> {
		this.stmts.updateAudioPath.run(path, messageId);
	}

	async getMostRecentSession(): Promise<Session | null> {
		const rows = this.stmts.listAllSessions.all() as SessionRow[];
		for (const row of rows) {
			if (row.status === 'active') return this.rowToSession(row);
		}
		return null;
	}

	async listWorkspaces(): Promise<string[]> {
		const rows = this.db.prepare(`SELECT DISTINCT workspace FROM sessions WHERE status = 'active' AND workspace != '' ORDER BY workspace ASC`).all() as Array<{ workspace: string }>;
		return rows.map((r) => r.workspace);
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

	async addAuditLog(entry: Omit<AuditLogEntry, 'id' | 'created_at'>): Promise<void> {
		this.stmts.insertAuditLog.run(
			crypto.randomUUID(),
			entry.session_id,
			entry.tool_name,
			entry.args,
			entry.confirmed ? 1 : 0,
			entry.success ? 1 : 0,
			entry.output.slice(0, 500),
			entry.workspace,
			Date.now()
		);
	}

	async listAuditLogs(limit?: number): Promise<AuditLogEntry[]> {
		const rows = this.stmts.listAuditLogs.all(limit ?? 100) as AuditLogRow[];
		return rows.map((row) => this.rowToAuditLog(row));
	}

	private rowToAuditLog(row: AuditLogRow): AuditLogEntry {
		return {
			id: row.id,
			session_id: row.session_id,
			tool_name: row.tool_name,
			args: row.args,
			confirmed: row.confirmed === 1,
			success: row.success === 1,
			output: row.output,
			workspace: row.workspace,
			created_at: row.created_at
		};
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
			workspace: row.workspace || ''
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
