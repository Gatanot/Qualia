import { openSync, closeSync, readFileSync, writeFileSync, existsSync, rmSync, mkdirSync, renameSync } from 'node:fs';
import { getQualiaHome, getServerLockPath, getServerInfoPath } from '$lib/paths';

/**
 * 后端单例锁
 *
 * Qualia 的后台服务（summarizer、scheduler、gateway）以及 SQLite/记忆等状态
 * 都锚定在全局 ~/.qualia，跨工作目录共享。为避免多个进程各自启动一份后台服务
 * 重复扫描、重复跑定时任务、重复 telegram long-poll，同一时刻只允许一个后端持有锁。
 *
 * 机制：以 O_EXCL 独占创建 ~/.qualia/server.lock；成功者写 ~/.qualia/server.json
 * （pid/host/port/startedAt）。检测到已有锁时，若记录的 pid 已死则视为陈旧锁并清理重试。
 *
 * 同一进程内可重入：serve.ts 先获取锁，随后 hooks.server.ts 再次获取时命中同进程缓存，
 * 直接返回同一 release（幂等）。这样 `qualia serve` 单进程既提供 HTTP 又启动后台服务。
 */

export interface ServerInfo {
	pid: number;
	host: string;
	port: number;
	startedAt: number;
}

export interface AcquireSuccess {
	acquired: true;
	release: () => void;
}

export interface AcquireFailure {
	acquired: false;
	existing: ServerInfo | null;
}

export type AcquireResult = AcquireSuccess | AcquireFailure;

/** 本进程是否已持有锁（可重入 + 幂等释放） */
let heldRelease: (() => void) | null = null;

function ensureHome(): void {
	const home = getQualiaHome();
	if (!existsSync(home)) mkdirSync(home, { recursive: true });
}

/** 检测 pid 对应的进程是否仍存活（signal 0 不发信号只做存在性检查） */
function isProcessAlive(pid: number): boolean {
	if (!Number.isInteger(pid) || pid <= 0) return false;
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		// ESRCH: 进程不存在；EPERM: 存在但无权限（仍算存活）
		return (error as NodeJS.ErrnoException).code === 'EPERM';
	}
}

export function readServerInfo(): ServerInfo | null {
	const infoPath = getServerInfoPath();
	if (!existsSync(infoPath)) return null;
	try {
		const raw = readFileSync(infoPath, 'utf-8');
		const parsed = JSON.parse(raw) as Partial<ServerInfo>;
		if (
			typeof parsed.pid !== 'number' ||
			typeof parsed.host !== 'string' ||
			typeof parsed.port !== 'number' ||
			typeof parsed.startedAt !== 'number'
		) {
			return null;
		}
		return { pid: parsed.pid, host: parsed.host, port: parsed.port, startedAt: parsed.startedAt };
	} catch {
		return null;
	}
}

/** 返回当前存活的后端信息；无（或仅陈旧记录）则 null。 */
export function getRunningServer(): ServerInfo | null {
	const info = readServerInfo();
	if (info && isProcessAlive(info.pid)) return info;
	return null;
}

function writeInfo(info: ServerInfo): void {
	const infoPath = getServerInfoPath();
	const tmpPath = infoPath + '.' + process.pid + '.tmp';
	writeFileSync(tmpPath, JSON.stringify(info, null, '\t'), 'utf-8');
	renameSync(tmpPath, infoPath);
}

function cleanup(lockPath: string): void {
	try { rmSync(lockPath, { force: true }); } catch { /* ignore */ }
	try { rmSync(getServerInfoPath(), { force: true }); } catch { /* ignore */ }
}

/** wx = O_CREAT | O_EXCL，已存在则抛 EEXIST */
function tryCreateLock(lockPath: string): boolean {
	try {
		closeSync(openSync(lockPath, 'wx'));
		return true;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'EEXIST') return false;
		throw error;
	}
}

/**
 * 尝试获取后端单例锁。
 *
 * @param info 本进程的 host/port（pid/startedAt 自动填充）
 * @returns acquired=true 并附 release()，或 acquired=false 并附现有实例信息
 */
export function acquireServerLock(info: { host: string; port: number }): AcquireResult {
	// 同进程可重入：已持有则复用同一 release
	if (heldRelease) return { acquired: true, release: heldRelease };

	ensureHome();
	const lockPath = getServerLockPath();

	if (!tryCreateLock(lockPath)) {
		const existing = getRunningServer();
		if (existing) {
			return { acquired: false, existing };
		}
		// 陈旧锁（持有者已死）：用原子 rename「夺取」锁文件，串行化清理，避免
		// 多个进程同时 cleanup + create 各自把对方新建的锁删掉、双双获取（TOCTOU）。
		// renameSync 对同一源文件并发只会有一个成功，其余抛 ENOENT。
		const stalePath = `${lockPath}.stale.${process.pid}.${Date.now()}`;
		try {
			renameSync(lockPath, stalePath);
		} catch {
			// 未能夺取：要么被别的进程抢先夺走，要么已有活后端重建了锁
			return { acquired: false, existing: getRunningServer() ?? readServerInfo() };
		}
		try { rmSync(stalePath, { force: true }); } catch { /* ignore */ }
		try { rmSync(getServerInfoPath(), { force: true }); } catch { /* ignore */ }
		if (!tryCreateLock(lockPath)) {
			return { acquired: false, existing: getRunningServer() ?? readServerInfo() };
		}
	}

	writeInfo({
		pid: process.pid,
		host: info.host,
		port: info.port,
		startedAt: Date.now()
	});

	let released = false;
	const release = () => {
		if (released) return;
		released = true;
		heldRelease = null;
		cleanup(lockPath);
	};
	heldRelease = release;

	// 进程正常/异常退出兜底清理
	process.once('exit', () => release());

	return { acquired: true, release };
}
