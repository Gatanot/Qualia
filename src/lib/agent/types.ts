import type { Usage, Message } from '$lib/provider';
import type { PendingConfirmation } from '$lib/tool';

export type AgentEvent =
	| { type: 'content'; text: string }
	| { type: 'tool_call'; name: string; args: Record<string, unknown> }
	| { type: 'tool_result'; name: string; success: boolean; output: string }
	| { type: 'confirm_required'; confirmId: string; confirmation: PendingConfirmation }
	| { type: 'error'; message: string }
	| { type: 'forked'; newSessionId: string; summary: string }
	| { type: 'done'; messageId: string; usage?: Usage };

export interface BuildResult {
	messages: Message[];
	forked?: { newSessionId: string; summary: string };
}

export type ConfirmFn = (confirmation: PendingConfirmation) => Promise<boolean>;
