import process from 'node:process';
import type { Command } from './index.js';

async function run(_args: string[]): Promise<number> {
	const { TUIApp } = await import('../tui/app.js');
	const app = new TUIApp(process.cwd());
	try {
		await app.start();
		return 0;
	} catch (e) {
		console.error('TUI 错误：', (e as Error).message);
		return 1;
	}
}

export const chatCommand: Command = {
	name: 'chat',
	aliases: [],
	description: '进入交互式终端对话',
	usage: 'qualia chat',
	run,
};
