import process from 'node:process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runServe } from './serve.js';
import { runPrompt } from './prompt.js';
import { runChat } from './chat.js';
import { runDoctor } from './doctor.js';
import { runModel } from './model.js';
import { runConfig } from './config.js';
import { runSession } from './session.js';
import { CliError } from '../errors.js';

export interface CliIO {
	stdin: NodeJS.ReadStream;
	stdout: NodeJS.WriteStream;
	stderr: NodeJS.WriteStream;
	cwd: string;
}

export interface ParsedArgs {
	command: string;
	positionals: string[];
	flags: Map<string, string | boolean>;
}

export const VERSION: string = (
	JSON.parse(
		readFileSync(
			join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'package.json'),
			'utf8'
		)
	) as { version: string }
).version;

const HELP = `Qualia CLI

用法：
  qualia                         进入交互式 TUI
  qualia chat                    进入交互式 TUI
  qualia -p "提示词"             非交互单次任务
  qualia prompt "提示词"         非交互单次任务
  qualia serve [--port 5173]     启动共享后端（Web + 后台服务）
  qualia doctor                  检查本地环境
  qualia model list|use          查看或选择模型
  qualia config get|set|path     查看或修改低风险配置
  qualia session list|show|open  管理会话

说明：chat/prompt 会连到共享后端；若无运行中的后端则自动在后台拉起一个（退出后常驻，供其他客户端复用）。

通用选项：
  --workspace <path>             指定工具工作区
  --model <modelId>              仅本次运行覆盖 activeModel
  --session <id>                 使用已有会话
  --new-session                  强制创建新会话
  --json                         输出 JSON/JSONL
  --no-color                     禁用颜色
  -h, --help                     显示帮助
  -v, --version                  显示版本
`;

export async function runCli(argv: string[], io: CliIO): Promise<void> {
	if (argv.length === 0) {
		await runChat(parseArgs(['chat']), io);
		return;
	}

	if (argv.includes('-h') || argv.includes('--help')) {
		io.stdout.write(HELP);
		return;
	}

	if (argv.includes('-v') || argv.includes('--version')) {
		io.stdout.write(`${VERSION}\n`);
		return;
	}

	if (argv[0] === '-p' || argv[0] === '--prompt') {
		await runPrompt(parseArgs(['prompt', ...argv.slice(1)]), io);
		return;
	}

	const parsed = parseArgs(argv);
	switch (parsed.command) {
		case 'chat':
			await runChat(parsed, io);
			break;
		case 'prompt':
			await runPrompt(parsed, io);
			break;
		case 'serve':
			await runServe(parsed, io);
			break;
		case 'doctor':
			await runDoctor(parsed, io);
			break;
		case 'model':
			await runModel(parsed, io);
			break;
		case 'config':
			await runConfig(parsed, io);
			break;
		case 'session':
			await runSession(parsed, io);
			break;
		default:
			throw new CliError('USAGE', `未知命令：${parsed.command}\n\n${HELP}`);
	}
}

export function parseArgs(argv: string[]): ParsedArgs {
	const command = argv[0] || 'chat';
	const positionals: string[] = [];
	const flags = new Map<string, string | boolean>();

	for (let i = 1; i < argv.length; i++) {
		const item = argv[i];
		if (!item.startsWith('-')) {
			positionals.push(item);
			continue;
		}

		const eq = item.indexOf('=');
		if (eq !== -1) {
			flags.set(item.slice(0, eq), item.slice(eq + 1));
			continue;
		}

		const next = argv[i + 1];
		if (next && !next.startsWith('-')) {
			flags.set(item, next);
			i++;
		} else {
			flags.set(item, true);
		}
	}

	return { command, positionals, flags };
}

export function flag(args: ParsedArgs, long: string, short?: string): string | undefined {
	const value = args.flags.get(long) ?? (short ? args.flags.get(short) : undefined);
	if (typeof value === 'string') return value;
	if (value === true) return '';
	return undefined;
}

export function boolFlag(args: ParsedArgs, long: string, short?: string): boolean {
	return args.flags.get(long) === true || (short ? args.flags.get(short) === true : false);
}

export function readStdin(io: CliIO): Promise<string> {
	if (io.stdin.isTTY) return Promise.resolve('');
	io.stdin.setEncoding('utf8');
	return new Promise((resolve, reject) => {
		let data = '';
		io.stdin.on('data', (chunk) => {
			data += chunk;
		});
		io.stdin.on('end', () => resolve(data));
		io.stdin.on('error', reject);
	});
}

process.on('SIGPIPE', () => {
	process.exit(0);
});
