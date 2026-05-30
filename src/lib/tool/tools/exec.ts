import { exec } from 'node:child_process';
import type { ToolDef, ToolResult } from '../types';
import { classifyCommand } from '../safeguard';
import { PendingConfirmation } from '../types';

const DEFAULT_TIMEOUT = 300_000;
const MAX_ALLOWED_TIMEOUT = 3_600_000;
const MAX_OUTPUT = 50_000;

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
	description: '在工作区目录执行终端命令并返回输出。仅用于开发任务，非交互式命令。默认超时 5 分钟。',
	parameters: {
		type: 'object',
		properties: {
			command: {
				type: 'string',
				description: '要执行的终端命令'
			},
			timeout: {
				type: 'number',
				description: '超时秒数，默认 300（5 分钟），最大 3600（1 小时）'
			}
		},
		required: ['command']
	},

	async execute(args: Record<string, unknown>, workspaceRoot: string): Promise<ToolResult> {
		const command = args.command as string;
		if (!command) {
			return { success: false, output: '', error: '缺少参数: command' };
		}

		let timeoutSec = typeof args.timeout === 'number' && args.timeout > 0 ? args.timeout : DEFAULT_TIMEOUT / 1000;
		if (timeoutSec > MAX_ALLOWED_TIMEOUT / 1000) timeoutSec = MAX_ALLOWED_TIMEOUT / 1000;
		const timeoutMs = timeoutSec * 1000;

		const classification = classifyCommand(command, workspaceRoot);

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
				{ command },
				`需要确认执行命令:\n${command}`
			);
		}

		if (args.__confirmed) {
			const recheck = classifyCommand(command, workspaceRoot);
			if (recheck === 'reject') {
				return {
					success: false,
					output: '',
					error: `拒绝执行危险命令: ${command.slice(0, 80)}`
				};
			}
		}

		return new Promise((resolve) => {
			const timer = setTimeout(() => {
				child.kill();
				resolve({
					success: false,
					output: '',
					error: `命令执行超时 (${timeoutSec} 秒)`
				});
			}, timeoutMs);

			const child = exec(
				command,
				{
					cwd: workspaceRoot,
					maxBuffer: MAX_OUTPUT,
					shell: process.platform === 'win32' ? 'powershell.exe' : '/bin/bash',
					timeout: timeoutMs
				},
				(error, stdout, stderr) => {
					clearTimeout(timer);

					const out = stdout?.toString() || '';
					const err = stderr?.toString() || '';

					if (error && !out && !err) {
						resolve({
							success: false,
							output: '',
							error: error.message
						});
						return;
					}

					const output = [out, err ? `\n[stderr]\n${err}` : '']
						.filter(Boolean)
						.join('')
						.slice(0, MAX_OUTPUT);

					resolve({
						success: error ? !error.killed : true,
						output: output || '(无输出)',
						error: error?.killed ? '命令被终止' : undefined
					});
				}
			);
		});
	}
};
