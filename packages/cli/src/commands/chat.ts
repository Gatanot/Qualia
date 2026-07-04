import { TuiApp } from '../tui/app.js';
import { parseStorageOverride } from '../runtime/config-loader.js';
import { resolveWorkspace } from '../runtime/workspace.js';
import { boolFlag, flag, type CliIO, type ParsedArgs } from './index.js';

export async function runChat(args: ParsedArgs, io: CliIO): Promise<void> {
	const workspace = resolveWorkspace(flag(args, '--workspace'), io.cwd);
	const app = new TuiApp({
		io,
		workspace,
		sessionId: flag(args, '--session'),
		newSession: boolFlag(args, '--new-session'),
		modelId: flag(args, '--model'),
		storageEnabled: parseStorageOverride(flag(args, '--storage'))
	});
	await app.start();
}
