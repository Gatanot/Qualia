import { TuiApp } from '../tui/app.js';
import { ensureBackend } from '../runtime/backend.js';
import { resolveWorkspace } from '../runtime/workspace.js';
import { boolFlag, flag, type CliIO, type ParsedArgs } from './index.js';

export async function runChat(args: ParsedArgs, io: CliIO): Promise<void> {
	const workspace = resolveWorkspace(flag(args, '--workspace'), io.cwd);
	const backend = await ensureBackend();
	const app = new TuiApp({
		io,
		workspace,
		baseURL: backend.baseURL,
		sessionId: flag(args, '--session'),
		newSession: boolFlag(args, '--new-session'),
		modelId: flag(args, '--model')
	});
	await app.start();
}
