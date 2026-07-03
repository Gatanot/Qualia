import process from 'node:process';
import type { Command } from './index.js';
import { AgentRunner } from '../runtime/agent-runner.js';

async function run(args: string[]): Promise<number> {
	const prompt = args.join(' ');
	if (!prompt.trim()) {
		console.error('错误：-p 需要传入 prompt，例如 qualia -p "总结 README"');
		return 2;
	}

	const runner = new AgentRunner();
	const validation = runner.validate();
	if (!validation.ok) {
		console.error(validation.error || '配置无效');
		return 3;
	}

	await runner.run({
		message: prompt,
		workspace: process.cwd(),
		onConfirm: async () => false,
		onEvent: (event) => {
			switch (event.type) {
				case 'content':
					process.stdout.write(event.text);
					break;
				case 'tool_call':
					process.stderr.write(`[tool] ${event.name}\n`);
					break;
				case 'tool_execution_update':
					process.stdout.write(event.text);
					break;
				case 'error':
					process.stderr.write(`[error] ${event.message}\n`);
					break;
			}
		},
	});

	process.stdout.write('\n');
	return 0;
}

export const promptCommand: Command = {
	name: 'prompt',
	aliases: ['-p', '--prompt'],
	description: '运行单次任务，输出结果到 stdout',
	usage: 'qualia prompt "your prompt"',
	run,
};
