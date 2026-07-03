import process from 'node:process';
import { createServer } from 'node:http';
import type { Command } from './index.js';

async function run(args: string[]): Promise<number> {
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

	return 0;
}

export const serveCommand: Command = {
	name: 'serve',
	aliases: [],
	description: '启动 Web 服务器',
	usage: 'qualia serve [--port <port>]',
	run,
};
