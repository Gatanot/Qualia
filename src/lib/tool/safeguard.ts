import { resolve, relative, isAbsolute, sep } from 'node:path';
import type { CommandClassification } from './types';

const DANGEROUS_PATTERNS: RegExp[] = [
	// Windows: recursive force delete
	/del\s+\/[fs].*\/[sq]/i,
	/rmdir\s+\/[sq]/i,
	/Remove-Item\s+.*-(Recurse|Force)/i,
	// Windows: system modification
	/\bformat\b/i,
	/\bdiskpart\b/i,
	/reg\s+(delete|add)/i,
	/Set-ExecutionPolicy/i,
	// Windows: shutdown / service
	/\bshutdown\b/i,
	/Restart-Computer\b/i,
	/Stop-Process\s+.*(svchost|winlogon|lsass|csrss)/i,
	/Stop-Service\b/i,
	// Windows: pipe to execution
	/\|\s*iex\b/i,
	/\|\s*Invoke-Expression\b/i,
	/\|\s*cmd\b/i,
	// Windows: redirect to system paths
	/>\s*%SystemRoot%/i,
	/>\s*C:\\Windows/i,
	// Unix: recursive force delete
	/\brm\s+-rf?\b/,
	/\bfind\b.*\bdelete\b/,
	// Unix: system modification
	/\bdd\s+if=/,
	/\bmkfs\./,
	/\bchmod\s+777\s+\//,
	// Unix: shutdown
	/\bshutdown\b/,
	/\breboot\b/,
	/\binit\s+[06]/,
	// Unix: redirect to system paths
	/>\s*\/etc\//,
	/>\s*\/bin\//,
	/>\s*\/boot\//,
	// Unix: pipe to shell
	/\|\s*(ba)?sh\b/,
	/\|\s*zsh\b/,
	// Cross-platform: dangerous patterns
	/\bdrop\s+table\b/i,
	/\bdrop\s+database\b/i,
	/\bgit\s+push\s+--force\b/i,
	/\bgit\s+reset\s+--hard\b/i
];

const SYSTEM_DIRS = [
	'C:\\Windows',
	'C:\\Program Files',
	'C:\\Program Files (x86)',
	'/etc',
	'/bin',
	'/sbin',
	'/usr/bin',
	'/usr/sbin',
	'/boot',
	'/sys',
	'/dev',
	'/proc'
];

/**
 * 检测命令字符串是否包含危险模式
 *
 * 使用正则匹配识别格式化、强制删除、系统修改、管道注入等危险操作。
 */
export function isDangerousCommand(command: string): boolean {
	return DANGEROUS_PATTERNS.some((pattern) => pattern.test(command));
}

/**
 * 判断目标路径是否在工作区目录内
 */
export function isPathInWorkspace(targetPath: string, workspaceRoot: string): boolean {
	const resolved = normalizePath(targetPath, workspaceRoot);
	const normalizedRoot = resolve(workspaceRoot).toLowerCase();
	const normalizedTarget = resolve(resolved).toLowerCase();

	return normalizedTarget.startsWith(normalizedRoot + sep);
}

/**
 * 判断目标路径是否在系统保护目录内
 */
export function isSystemPath(targetPath: string, workspaceRoot: string): boolean {
	const resolved = normalizePath(targetPath, workspaceRoot);
	const normalized = resolve(resolved).toLowerCase();

	return SYSTEM_DIRS.some((sysDir) => normalized.startsWith(sysDir.toLowerCase()));
}

/**
 * 从命令字符串中提取所有路径参数
 */
export function extractPaths(command: string): string[] {
	const paths: string[] = [];

	const winPathRe = /[A-Za-z]:\\(?:[^\\/:*?"<>|\r\n]+\\)*[^\\/:*?"<>|\r\n]*/g;
	let match: RegExpExecArray | null;
	while ((match = winPathRe.exec(command)) !== null) {
		paths.push(match[0]);
	}

	const unixPathRe = /(?<!\w)\/(?:[^\s'"]+)/g;
	while ((match = unixPathRe.exec(command)) !== null) {
		const p = match[0];
		if (p.length > 1 && !p.match(/^\/\d/) && !p.match(/\/$/)) {
			paths.push(p);
		}
	}

	return paths;
}

/**
 * 分类命令的安全性
 *
 * @returns 'safe' 可直接执行 / 'confirm' 需用户确认 / 'reject' 拒绝执行
 */
export function classifyCommand(
	command: string,
	workspaceRoot: string
): CommandClassification {
	if (/^\s*(format|diskpart)\b/i.test(command.trim())) {
		return 'reject';
	}

	if (isDangerousCommand(command)) {
		return 'confirm';
	}

	const paths = extractPaths(command);
	for (const p of paths) {
		if (isSystemPath(p, workspaceRoot)) {
			return 'confirm';
		}
		if (!isPathInWorkspace(p, workspaceRoot)) {
			return 'confirm';
		}
	}

	return 'safe';
}

/**
 * 分类文件路径的安全性
 *
 * @returns 'safe' 可直接操作 / 'confirm' 需用户确认
 */
export function classifyFilePath(
	targetPath: string,
	workspaceRoot: string
): CommandClassification {
	const normalized = normalizePath(targetPath, workspaceRoot);

	if (isSystemPath(normalized, workspaceRoot)) {
		return 'confirm';
	}

	if (!isPathInWorkspace(normalized, workspaceRoot)) {
		return 'confirm';
	}

	return 'safe';
}

function normalizePath(targetPath: string, workspaceRoot: string): string {
	if (isAbsolute(targetPath)) {
		return targetPath;
	}
	return resolve(workspaceRoot, targetPath);
}
