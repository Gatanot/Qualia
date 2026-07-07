import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getRunningServer, type ServerInfo } from '@gatanot/qualia_core/server';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 5173;
const READY_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 200;

export interface BackendHandle {
	baseURL: string;
	/** 本进程是否亲自拉起了后端（detached，退出后仍常驻） */
	spawned: boolean;
}

function infoToBaseURL(info: ServerInfo): string {
	const host = info.host === '0.0.0.0' ? DEFAULT_HOST : info.host;
	return `http://${host}:${info.port}`;
}

async function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 探测 /api/models，返回后端是否已能响应 HTTP */
async function probe(baseURL: string): Promise<boolean> {
	try {
		const res = await fetch(`${baseURL}/api/models`, { method: 'GET' });
		return res.ok;
	} catch {
		return false;
	}
}

/** 解析 CLI 自身入口 cli.js，用 node 以 detached 方式拉起 `serve` */
function spawnServe(host: string, port: number): void {
	// dist/runtime/backend.js → dist/cli.js
	const cliEntry = join(dirname(dirname(fileURLToPath(import.meta.url))), 'cli.js');
	const child = spawn(
		process.execPath,
		[cliEntry, 'serve', '--host', host, '--port', String(port)],
		{ detached: true, stdio: 'ignore' }
	);
	child.unref();
}

/**
 * 确保有一个可用的共享后端，返回其 baseURL。
 *
 * 1. 已有存活后端（~/.qualia/server.json 且 pid 存活）→ 直接复用。
 * 2. 否则以 detached 方式拉起 `qualia serve`（退出后常驻，供其他客户端复用），
 *    轮询 /api/models 直到就绪或超时。
 *
 * @throws Error 后端在超时内未就绪
 */
export async function ensureBackend(opts?: { host?: string; port?: number }): Promise<BackendHandle> {
	const host = opts?.host || DEFAULT_HOST;
	const port = opts?.port || DEFAULT_PORT;

	const existing = getRunningServer();
	if (existing) {
		const baseURL = infoToBaseURL(existing);
		if (await probe(baseURL)) {
			return { baseURL, spawned: false };
		}
		// server.json 指向的进程还在但 HTTP 未响应（刚启动中）：继续等它就绪
		const deadline = Date.now() + READY_TIMEOUT_MS;
		while (Date.now() < deadline) {
			await sleep(POLL_INTERVAL_MS);
			if (await probe(baseURL)) return { baseURL, spawned: false };
			if (!getRunningServer()) break;
		}
	}

	// 无存活后端：亲自拉起
	spawnServe(host, port);
	const baseURL = `http://${host}:${port}`;
	const deadline = Date.now() + READY_TIMEOUT_MS;
	while (Date.now() < deadline) {
		await sleep(POLL_INTERVAL_MS);
		if (await probe(baseURL)) return { baseURL, spawned: true };
	}

	throw new Error(`后端在 ${READY_TIMEOUT_MS / 1000}s 内未就绪：${baseURL}`);
}
