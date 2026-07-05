import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SQLiteStorage } from './sqlite.js';
import type { Session } from './types.js';
import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('SQLiteStorage', () => {
	let dbPath: string;
	let dbDir: string;
	let storage: SQLiteStorage;

	beforeAll(() => {
		dbDir = mkdtempSync(join(tmpdir(), 'qualia-test-'));
		dbPath = join(dbDir, 'test.db');
		storage = new SQLiteStorage(dbPath);
	});

	afterAll(() => {
		try { rmSync(dbDir, { recursive: true, force: true }); } catch { /* Windows file lock */ }
	});

	async function createTestSession(title = 'Test Session', workspace = '/tmp/test'): Promise<Session> {
		return await storage.createSession(title, workspace);
	}

	// ── forkSession ──

	it('forkSession creates a new session with copied messages', async () => {
		const parent = await createTestSession('Parent Session');
		await storage.addMessage(parent.id, { session_id: parent.id, role: 'user', content: 'hello' });
		await storage.addMessage(parent.id, { session_id: parent.id, role: 'assistant', content: 'hi there' });

		const child = await storage.forkSession(parent.id);

		expect(child.id).not.toBe(parent.id);
		expect(child.title).toContain('[分叉]');
		expect(child.workspace).toBe(parent.workspace);

		const childMsgs = await storage.getMessages(child.id);
		expect(childMsgs).toHaveLength(2);
		expect(childMsgs[0].content).toBe('hello');
		expect(childMsgs[1].content).toBe('hi there');
	});

	it('forkSession sets parent_id on child session', async () => {
		const parent = await createTestSession();
		await storage.addMessage(parent.id, { session_id: parent.id, role: 'user', content: 'msg' });

		const child = await storage.forkSession(parent.id);

		const fetchedChild = await storage.getSession(child.id);
		expect(fetchedChild!.parent_id).toBe(parent.id);
	});

	// ── deleteSession ──

	it('deleteSession removes session and its messages', async () => {
		const session = await createTestSession();
		await storage.addMessage(session.id, { session_id: session.id, role: 'user', content: 'msg1' });
		await storage.addMessage(session.id, { session_id: session.id, role: 'assistant', content: 'msg2' });

		await storage.deleteSession(session.id);

		const deleted = await storage.getSession(session.id);
		expect(deleted).toBeNull();

		const msgs = await storage.getMessages(session.id);
		expect(msgs).toHaveLength(0);
	});

	// ── audit_logs table ──

	it('creates audit_logs table automatically', () => {
		const db = new Database(dbPath);
		const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='audit_logs'").all() as Array<{ name: string }>;
		db.close();
		expect(tables.some((t) => t.name === 'audit_logs')).toBe(true);
	});

	it('addAuditLog inserts a record', async () => {
		const session = await createTestSession();
		await storage.addAuditLog({
			session_id: session.id, tool_name: 'read_file',
			args: JSON.stringify({ path: '/tmp/test.txt' }), confirmed: false,
			success: true, output: 'file contents here', workspace: '/tmp/test'
		});

		const db = new Database(dbPath);
		const rows = db.prepare('SELECT * FROM audit_logs WHERE session_id = ?').all(session.id) as Array<Record<string, unknown>>;
		db.close();

		expect(rows).toHaveLength(1);
		expect(rows[0].tool_name).toBe('read_file');
		expect(rows[0].success).toBe(1);
		expect(rows[0].confirmed).toBe(0);
	});

	it('listAuditLogs returns entries ordered by created_at DESC', async () => {
		const s = await createTestSession();
		await storage.addAuditLog({
			session_id: s.id, tool_name: 'tool_first', args: '{}', confirmed: false, success: true, output: '', workspace: ''
		});
		await new Promise((r) => setTimeout(r, 5));
		await storage.addAuditLog({
			session_id: s.id, tool_name: 'tool_second', args: '{}', confirmed: false, success: true, output: '', workspace: ''
		});

		const logs = await storage.listAuditLogs(100);
		const ownLogs = logs.filter((l) => l.session_id === s.id);
		expect(ownLogs).toHaveLength(2);
		expect(ownLogs[0].tool_name).toBe('tool_second');
		expect(ownLogs[1].tool_name).toBe('tool_first');
	});

	it('addAuditLog truncates output to 500 chars', async () => {
		const session = await createTestSession();
		await storage.addAuditLog({
			session_id: session.id, tool_name: 'test', args: '{}',
			confirmed: false, success: true, output: 'x'.repeat(800), workspace: ''
		});

		const logs = await storage.listAuditLogs(100);
		const ourLog = logs.find((l) => l.session_id === session.id);
		expect(ourLog!.output).toHaveLength(500);
	});

	it('audit logs cascade-deleted with session', async () => {
		const session = await createTestSession();
		await storage.addAuditLog({
			session_id: session.id, tool_name: 'test', args: '{}',
			confirmed: false, success: true, output: 'x', workspace: ''
		});

		await storage.deleteSession(session.id);
		const logs = await storage.listAuditLogs(100);
		expect(logs.filter((l) => l.session_id === session.id)).toHaveLength(0);
	});
});
