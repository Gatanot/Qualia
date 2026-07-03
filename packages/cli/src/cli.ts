#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';
import { createServer } from 'node:http';

// better-sqlite3 是 CJS native 模块，需要 ESM polyfill
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
Object.assign(globalThis, { __filename, __dirname });

const args = process.argv.slice(2);

const VERSION = '0.1.2';

function printHelp(): void {
	console.log(`Qualia CLI v${VERSION} — local personal AI companion

Usage:
  qualia                         Start interactive TUI
  qualia serve [--port <port>]   Start web server
  qualia -p "prompt"             Run a single prompt (coming soon)
  qualia --help                  Show this help
  qualia --version               Show version

Options:
  --port <port>    Port for web server (default: 5173)

Examples:
  qualia                          # Enter interactive terminal chat
  qualia serve --port 8080        # Start web interface on port 8080
  qualia -p "Summarize this file" # Run once and exit
`);
}

function printVersion(): void {
	console.log(`qualia v${VERSION}`);
}

function isTTY(): boolean {
	return process.stdin.isTTY === true && process.stdout.isTTY === true;
}

async function runServe(): Promise<void> {
	const portIdx = args.indexOf('--port');
	const port = portIdx !== -1 ? parseInt(args[portIdx + 1], 10) || 5173 : 5173;

	const { handler } = await import('@gatanot/qualia_web/handler');

	const server = createServer(handler);
	server.on('error', (err: NodeJS.ErrnoException) => {
		if (err.code === 'EADDRINUSE') {
			console.error(`端口 ${port} 已被占用，请使用 --port 指定其他端口`);
		} else {
			console.error(`服务器错误: ${err.message}`);
		}
		process.exit(1);
	});

	server.listen(port, () => {
		console.log(`Qualia Web — http://localhost:${port}`);
		console.log(`Config: ~/.qualia/config.json`);
	});

	process.on('SIGINT', () => { server.close(); process.exit(0); });
	process.on('SIGTERM', () => { server.close(); process.exit(0); });
}

async function runPrompt(): Promise<void> {
	const prompt = args.slice(1).join(' ');
	console.log('Non-interactive mode — coming soon');
	console.log(`Prompt: ${prompt}`);
	process.exit(0);
}

async function runTUI(): Promise<void> {
	if (!isTTY()) {
		console.error('Error: TUI requires a terminal (TTY). Use qualia serve for web mode or qualia -p for non-interactive mode.');
		process.exit(1);
	}

	const { TUIApp } = await import('./tui/app.js');
	const app = new TUIApp(process.cwd());
	try {
		await app.start();
		process.exit(0);
	} catch (e) {
		console.error('TUI 错误：', (e as Error).message);
		process.exit(1);
	}
}

// Route commands
const cmd = args[0];

if (cmd === '--help' || cmd === '-h') {
	printHelp();
	process.exit(0);
}

if (cmd === '--version' || cmd === '-v' || cmd === '-V') {
	printVersion();
	process.exit(0);
}

if (cmd === 'serve') {
	await runServe();
} else if (cmd === '-p' || cmd === '--prompt') {
	await runPrompt();
} else if (!cmd || cmd.startsWith('-')) {
	await runTUI();
} else {
	console.error(`Unknown command: ${cmd}`);
	console.error('Run qualia --help for usage.');
	process.exit(2);
}
