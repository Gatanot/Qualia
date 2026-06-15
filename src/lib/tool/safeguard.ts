import { resolve, isAbsolute, sep } from 'node:path';
import type { CommandClassification } from './types';

const READONLY_PATTERNS: RegExp[] = [
	// PowerShell read-only cmdlets & aliases
	/^\s*(?:Get-ChildItem|dir|ls|Get-Content|cat|type|Get-Process|ps|Get-Service|Get-Location|pwd|gl|Get-Item|gi|Get-ItemProperty|gp|Get-Date|Get-Host|Get-Variable|gv|Get-Command|gcm|Get-Member|gm|Get-Alias|gal|Get-History|history|ghy|Select-String|sls|findstr|Test-Path|Measure-Object|measure|Sort-Object|sort|Group-Object|group|Select-Object|select|Format-List|fl|Format-Table|ft|Format-Wide|fw|Format-Hex|Write-Output|echo|write|Compare-Object|diff|compare|Where-Object|Join-Path|Split-Path|Resolve-Path|ConvertFrom-Json|ConvertFrom-Csv)\b/i,
	// Unix read-only
	/^\s*(?:head|tail|less|more|grep|egrep|fgrep|rg|find|wc|sort|uniq|cut|tr|file|stat|df|du|which|whereis|command|whoami|id|groups|printf|uname|hostname|basename|dirname|readlink|realpath)\b/i,
	// Git read-only
	/^\s*git\s+(?:status|log|diff|show|branch|tag|stash\s+list|remote\s+(?:-v|show)|config\s+(?:--list|--get\b)|ls-files|rev-parse|rev-list|describe|shortlog|blame|grep|notes\s+list|reflog|cherry|for-each-ref|name-rev)\b/i,
	// npm read-only
	/^\s*npm\s+(?:ls|list|view|info|outdated|version|config\s+list)\b/i
];

const DANGEROUS_PATTERNS: RegExp[] = [
	// Windows: delete operations (all forms — confirm before any deletion)
	/^\s*del\b/i,
	/^\s*rmdir\b/i,
	/^\s*Remove-Item\b/i,
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

function isDangerousCommand(command: string): boolean {
	if (DANGEROUS_PATTERNS.some((pattern) => pattern.test(command))) {
		return true;
	}
	for (const segment of command.split('|')) {
		if (DANGEROUS_PATTERNS.some((pattern) => pattern.test(segment))) {
			return true;
		}
	}
	return false;
}

function isReadonlyCommand(command: string): boolean {
	for (const segment of command.split('|')) {
		if (!READONLY_PATTERNS.some((pattern) => pattern.test(segment))) {
			return false;
		}
	}
	return true;
}

function isPathInWorkspace(targetPath: string, workspaceRoot: string): boolean {
	const resolved = normalizePath(targetPath, workspaceRoot);
	const normalizedRoot = resolve(workspaceRoot).toLowerCase();
	const normalizedTarget = resolve(resolved).toLowerCase();

	return normalizedTarget.startsWith(normalizedRoot + sep);
}

function isSystemPath(targetPath: string, workspaceRoot: string): boolean {
	const resolved = normalizePath(targetPath, workspaceRoot);
	const normalized = resolve(resolved).toLowerCase();

	return SYSTEM_DIRS.some((sysDir) => normalized.startsWith(sysDir.toLowerCase()));
}

function expandEnvVars(command: string): string {
	let result = command.replace(/%(\w+)%/g, (_, name) => {
		return process.env[name] ?? `%${name}%`;
	});
	result = result.replace(/\$\{(\w+)\}/g, (_, name) => {
		return process.env[name] ?? `\$\{${name}\}`;
	});
	result = result.replace(/\$([A-Za-z_]\w*)/g, (_, name) => {
		return process.env[name] ?? `$${name}`;
	});
	return result;
}

function collectPaths(source: string, paths: string[]): void {
	const winAbsRe = /[A-Za-z]:\\(?:[^\\/:*?"<>|\r\n]+\\)*[^\\/:*?"<>|\r\n]*/g;
	let match: RegExpExecArray | null;
	while ((match = winAbsRe.exec(source)) !== null) {
		paths.push(match[0]);
	}

	const unixAbsRe = /(?<!\w)\/(?:[^\s'"]+)/g;
	while ((match = unixAbsRe.exec(source)) !== null) {
		const p = match[0];
		if (p.length > 1 && !/^\/\d/.test(p) && !/\/$/.test(p)) {
			paths.push(p);
		}
	}

	const tildeRe = /(?<!\w)~\/(?:[^\s'"]+)/g;
	while ((match = tildeRe.exec(source)) !== null) {
		paths.push(match[0]);
	}
}

function extractPaths(command: string): string[] {
	const paths: string[] = [];

	collectPaths(command, paths);

	const expanded = expandEnvVars(command);
	if (expanded !== command) {
		collectPaths(expanded, paths);
	}

	const winRelRe = /(?:\.\.\\)+(?:[^\s'"]+)/g;
	let match: RegExpExecArray | null;
	while ((match = winRelRe.exec(command)) !== null) {
		paths.push(match[0]);
	}

	const unixRelRe = /(?<!\w)(?:\.\.\/)+(?:[^\s'"]+)/g;
	while ((match = unixRelRe.exec(command)) !== null) {
		const p = match[0];
		if (p.length > 1 && !/\/$/.test(p)) {
			paths.push(p);
		}
	}

	return paths;
}

/**
 * 分类命令的安全性
 *
 * 判定顺序：
 * 1. reject  — 明确禁止（format, diskpart）
 * 2. confirm — 命中危险模式（删除、系统修改、管道注入等）
 * 3. safe    — 只读命令，无需后续路径检查
 * 4. confirm — 路径在工作区外或系统目录
 * 5. safe    — 其余放行
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

	if (isReadonlyCommand(command)) {
		return 'safe';
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
		return 'reject';
	}

	if (!isPathInWorkspace(normalized, workspaceRoot)) {
		return 'confirm';
	}

	return 'safe';
}

function normalizePath(targetPath: string, workspaceRoot: string): string {
	let resolved = targetPath;
	if (resolved.startsWith('~')) {
		const home = process.env.HOME || process.env.USERPROFILE || '';
		resolved = resolved.replace(/^~/, home);
	}
	if (isAbsolute(resolved)) {
		return resolved;
	}
	return resolve(workspaceRoot, resolved);
}
