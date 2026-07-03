import readline from 'node:readline/promises';
import type { CliIO } from '../commands/index.js';

export class TerminalSession {
	private rl: readline.Interface;
	private closed = false;

	constructor(private readonly io: CliIO) {
		this.rl = readline.createInterface({
			input: io.stdin,
			output: io.stdout,
			terminal: true
		});
	}

	write(text: string): void {
		this.io.stdout.write(text);
	}

	writeError(text: string): void {
		this.io.stderr.write(text);
	}

	async question(prompt: string): Promise<string> {
		if (this.closed) throw new Error('终端会话已关闭');
		return this.rl.question(prompt);
	}

	close(): void {
		if (this.closed) return;
		this.closed = true;
		this.rl.close();
	}
}
