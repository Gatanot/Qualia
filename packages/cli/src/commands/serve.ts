import { createServer } from 'node:http';
import { CliError } from '../errors.js';
import { flag, type CliIO, type ParsedArgs } from './index.js';

export async function runServe(args: ParsedArgs, io: CliIO): Promise<void> {
	const portText = flag(args, '--port', '-p') || '5173';
	const host = flag(args, '--host') || '127.0.0.1';
	const port = Number.parseInt(portText, 10);
	if (!Number.isInteger(port) || port < 1 || port > 65535) {
		throw new CliError('USAGE', `端口无效：${portText}`);
	}

	let handler: (request: unknown, response: unknown) => void;
	try {
		const mod = await import('@gatanot/qualia_web/handler');
		handler = mod.handler as typeof handler;
	} catch (error) {
		throw new CliError('IO', '无法加载 @gatanot/qualia_web/handler。请确认 Web 包已构建并正确安装。', { cause: error });
	}

	const server = createServer(handler);
	await new Promise<void>((resolve, reject) => {
		server.once('error', reject);
		server.listen(port, host, () => resolve());
	}).catch((error) => {
		throw new CliError('IO', `启动 Web 服务失败：${(error as Error).message}`, { cause: error });
	});

	io.stdout.write(`Qualia Web: http://${host}:${port}\n`);
	io.stdout.write('Config: ~/.qualia/config.json\n');

	await new Promise<void>((resolve) => {
		const shutdown = () => {
			server.close(() => resolve());
		};
		process.once('SIGINT', shutdown);
		process.once('SIGTERM', shutdown);
	});
}
