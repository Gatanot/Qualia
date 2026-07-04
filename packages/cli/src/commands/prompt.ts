import type { AgentEvent, ConfirmFn } from '@gatanot/qualia_core/agent';
import { AgentRunner } from '../runtime/agent-runner.js';
import { parseStorageOverride } from '../runtime/config-loader.js';
import { resolveWorkspace } from '../runtime/workspace.js';
import { CliError } from '../errors.js';
import { boolFlag, flag, readStdin, type CliIO, type ParsedArgs } from './index.js';
import { summarizeEvent } from '../runtime/events.js';

export async function runPrompt(args: ParsedArgs, io: CliIO): Promise<void> {
	const stdinText = await readStdin(io);
	const message = [...args.positionals, stdinText].join(' ').trim();
	if (!message) {
		throw new CliError('USAGE', '缺少提示词。用法：qualia -p "你的任务"');
	}

	const workspace = resolveWorkspace(flag(args, '--workspace'), io.cwd);
	const controller = new AbortController();
	const json = boolFlag(args, '--json');
	const stream = boolFlag(args, '--stream');
	const yes = boolFlag(args, '--yes');

	const onConfirm: ConfirmFn = async (confirmation) => {
		if (yes) {
			io.stderr.write(`确认：自动批准 ${confirmation.toolName}：${confirmation.reason}\n`);
			return true;
		}
		io.stderr.write(`确认：自动拒绝 ${confirmation.toolName}：${confirmation.reason}\n`);
		return false;
	};

	const runner = new AgentRunner();
	const events: AgentEvent[] = [];
	const result = await runner.run({
		workspace,
		message,
		sessionId: flag(args, '--session'),
		newSession: boolFlag(args, '--new-session'),
		modelId: flag(args, '--model'),
		storageEnabled: parseStorageOverride(flag(args, '--storage')),
		signal: controller.signal,
		onConfirm,
		onEvent(event) {
			events.push(event);
			if (json) return;
			if (stream && event.type === 'content') io.stdout.write(event.text);
			const summary = summarizeEvent(event);
			if (summary && event.type !== 'tool_execution_update') io.stderr.write(`${summary}\n`);
		}
	});

	if (json) {
		io.stdout.write(JSON.stringify({
			sessionId: result.sessionId,
			messageId: result.doneMessageId,
			content: result.content,
			reasoning: result.reasoning || undefined,
			events
		}) + '\n');
		return;
	}

	if (!stream) io.stdout.write(`${result.content.trim()}\n`);
}
