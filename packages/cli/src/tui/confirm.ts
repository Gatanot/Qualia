import type { PendingConfirmation } from '@gatanot/qualia_core/tool';
import type { ConfirmFn } from '@gatanot/qualia_core/agent';
import { TerminalSession } from './terminal.js';

export function createTuiConfirm(term: TerminalSession): ConfirmFn {
	return async (confirmation: PendingConfirmation) => {
		term.write('\n');
		term.write(`需要确认工具：${confirmation.toolName}\n`);
		term.write(`原因：${confirmation.reason}\n`);
		term.write(`参数：${JSON.stringify(confirmation.args, null, 2)}\n`);
		const answer = (await term.question('批准本次操作？[y/N] ')).trim().toLowerCase();
		return answer === 'y' || answer === 'yes';
	};
}
