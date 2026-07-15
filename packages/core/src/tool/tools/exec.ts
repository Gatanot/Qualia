import { spawn, execSync } from 'node:child_process';
import type { ToolDef, ToolResult } from '../types.js';
import type { ToolContext } from '../env.js';
import { PendingConfirmation } from '../types.js';

const DEFAULT_TIMEOUT = 300_000;
const MAX_ALLOWED_TIMEOUT = 3_600_000;
const MAX_OUTPUT = 50_000;

const IS_WINDOWS = process.platform === 'win32';

function killProcessTree(pid: number | undefined): boolean {
	if (pid == null) return false;
	if (IS_WINDOWS) {
		try {
			execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' });
			return true;
		} catch {
			return false;
		}
	}
	try {
		process.kill(-pid, 'SIGKILL');
		return true;
	} catch {
		try {
			process.kill(pid, 'SIGKILL');
			return true;
		} catch {
			return false;
		}
	}
}

/**
 * execute_command — 执行终端命令
 *
 * 安全策略：
 * - 安全命令 + 工作区路径 → 直接执行
 * - 危险命令 → 需用户确认
 * - format/diskpart → 拒绝
 * - 默认超时 5 分钟，输出上限 50KB
 */
export const execTool: ToolDef = {
	name: 'execute_command',
	description: 'Execute a terminal command in the workspace directory and return output. For development tasks only, non-interactive. Default timeout 5 minutes.',
	parameters: {
		type: 'object',
		properties: {
			command: {
				type: 'string',
				description: 'The terminal command to execute'
			},
			timeout: {
				type: 'number',
				description: 'Timeout in seconds, default 300 (5 min), max 3600 (1 hour)'
			}
		},
		required: ['command']
	},

	async execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
		const command = args.command as string;
		if (!command) {
			return { success: false, output: '', error: '缺少参数: command' };
		}

		let timeoutSec = typeof args.timeout === 'number' && args.timeout > 0 ? args.timeout : DEFAULT_TIMEOUT / 1000;
		if (timeoutSec > MAX_ALLOWED_TIMEOUT / 1000) timeoutSec = MAX_ALLOWED_TIMEOUT / 1000;
		const timeoutMs = timeoutSec * 1000;

		const classification = ctx.classifyCommand(command);

		if (classification === 'reject') {
			return {
				success: false,
				output: '',
				error: `拒绝执行危险命令: ${command.slice(0, 80)}`
			};
		}

		if (classification === 'confirm' && !args.__confirmed) {
			throw new PendingConfirmation(
				'execute_command',
				{ ...args },
				`需要确认执行命令:\n${command}`
			);
		}

		if (args.__confirmed) {
			const recheck = ctx.classifyCommand(command);
			if (recheck === 'reject') {
				return {
					success: false,
					output: '',
					error: `拒绝执行危险命令: ${command.slice(0, 80)}`
				};
			}
		}

		return new Promise((resolve) => {
			const stdoutChunks: Buffer[] = [];
			const stderrChunks: Buffer[] = [];
			let resolved = false;
			let totalOutput = 0;
			let abortCleanup: (() => void) | undefined;

			const resolveResult = (success: boolean, error?: string) => {
				if (resolved) return;
				resolved = true;
				clearTimeout(timer);
				abortCleanup?.();
				const out = Buffer.concat(stdoutChunks).toString();
				const err = Buffer.concat(stderrChunks).toString();

				const output = [out, err ? `\n[stderr]\n${err}` : '']
					.filter(Boolean)
					.join('')
					.slice(0, MAX_OUTPUT);

				resolve({
					success,
					output: output || '(无输出)',
					error
				});
			};

			const timer = setTimeout(() => {
				if (!resolved) {
					if (!killProcessTree(child.pid)) {
						try { child.kill(); } catch { /* 忽略二次杀死失败 */ }
					}
					resolveResult(false, `命令执行超时 (${timeoutSec} 秒)`);
				}
			}, timeoutMs);

			let child: ReturnType<typeof spawn>;
			if (IS_WINDOWS) {
				child = spawn('powershell.exe', ['-NoProfile', '-Command', command], {
					cwd: ctx.root,
					stdio: ['ignore', 'pipe', 'pipe'],
					windowsHide: true
				});
			} else {
				child = spawn(command, [], {
					shell: '/bin/bash',
					cwd: ctx.root,
					stdio: ['ignore', 'pipe', 'pipe'],
					detached: true
				});
			}

			if (ctx.signal) {
				const onAbort = () => {
					if (resolved) return;
					if (!killProcessTree(child.pid)) {
						try { child.kill(); } catch { /* 忽略二次杀死失败 */ }
					}
					resolveResult(false, '命令已取消');
				};
				if (ctx.signal.aborted) {
					queueMicrotask(onAbort);
				} else {
					ctx.signal.addEventListener('abort', onAbort, { once: true });
					abortCleanup = () => ctx.signal?.removeEventListener('abort', onAbort);
				}
			}

			child.stdout?.on('data', (data: Buffer) => {
				stdoutChunks.push(data);
				totalOutput += data.length;
				if (totalOutput > MAX_OUTPUT) {
					if (!resolved) {
						if (!killProcessTree(child.pid)) {
							try { child.kill(); } catch { /* ignore */ }
						}
						resolveResult(false, '命令输出超过上限 (50KB)');
					}
				} else {
					ctx.onUpdate?.(data.toString());
				}
			});

			child.stderr?.on('data', (data: Buffer) => {
				stderrChunks.push(data);
				totalOutput += data.length;
				if (totalOutput > MAX_OUTPUT) {
					if (!resolved) {
						if (!killProcessTree(child.pid)) {
							try { child.kill(); } catch { /* ignore */ }
						}
						resolveResult(false, '命令输出超过上限 (50KB)');
					}
				} else {
					ctx.onUpdate?.(data.toString());
				}
			});

			child.on('close', (code) => {
				if (resolved) return;
				resolveResult(code === 0, code !== 0 ? `命令退出码: ${code}` : undefined);
			});

			child.on('error', (err) => {
				if (resolved) return;
				resolveResult(false, err.message);
			});
		});
	}
};
