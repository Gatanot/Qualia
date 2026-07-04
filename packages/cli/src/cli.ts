#!/usr/bin/env node
import { runCli } from './commands/index.js';
import { exitCodeFor, messageFor } from './errors.js';

try {
	await runCli(process.argv.slice(2), {
		stdin: process.stdin,
		stdout: process.stdout,
		stderr: process.stderr,
		cwd: process.cwd()
	});
} catch (error) {
	const message = messageFor(error);
	process.stderr.write(`错误：${message}\n`);
	process.exitCode = exitCodeFor(error);
}
