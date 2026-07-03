import { createStorage } from '@gatanot/qualia_core/storage';
import { readConfig } from '@gatanot/qualia_core/config';
import { CliError } from '../errors.js';
import { type CliIO, type ParsedArgs } from './index.js';

export async function runSession(args: ParsedArgs, io: CliIO): Promise<void> {
	const sub = args.positionals[0] || 'list';
	const storage = createStorage({ enabled: readConfig().storageEnabled });

	if (sub === 'list') {
		const sessions = await storage.listSessions();
		for (const session of sessions) {
			io.stdout.write(`${session.id}\t${new Date(session.updated_at).toLocaleString()}\t${session.title}\t${session.workspace || ''}\n`);
		}
		return;
	}

	if (sub === 'show') {
		const id = args.positionals[1];
		if (!id) throw new CliError('USAGE', '用法：qualia session show <id>');
		const session = await storage.getSession(id);
		if (!session) throw new CliError('USAGE', `会话不存在：${id}`);
		const messages = await storage.getMessages(id);
		io.stdout.write(`# ${session.title}\n\n`);
		for (const message of messages) {
			io.stdout.write(`## ${message.role}\n\n${message.content}\n\n`);
		}
		return;
	}

	if (sub === 'delete') {
		const id = args.positionals[1];
		if (!id) throw new CliError('USAGE', '用法：qualia session delete <id>');
		await storage.deleteSession(id);
		io.stdout.write(`已删除会话：${id}\n`);
		return;
	}

	if (sub === 'open') {
		const id = args.positionals[1];
		if (!id) throw new CliError('USAGE', '用法：qualia session open <id>');
		args.positionals = [];
		args.flags.set('--session', id);
		const { runChat } = await import('./chat.js');
		await runChat(args, io);
		return;
	}

	throw new CliError('USAGE', `未知 session 子命令：${sub}`);
}
