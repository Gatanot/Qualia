import type { Usage } from '$lib/ai';

export interface ToolResult {
	success: boolean;
	output: string;
}

export interface ImageAttachment {
	url: string;
	detail?: 'low' | 'high' | 'auto';
}

export type ContentBlock =
	| { type: 'text'; content: string }
	| { type: 'reasoning'; content: string }
	| { type: 'tool'; name: string; args: Record<string, unknown>; result?: ToolResult }
	| { type: 'confirm'; confirmId: string; message: string }
	| { type: 'error_recovery'; message: string }
	| { type: 'image'; url: string; detail?: 'low' | 'high' | 'auto' };

export interface UIMessage {
	id: string;
	role: 'user' | 'assistant' | 'tool' | 'error';
	blocks: ContentBlock[];
	done: boolean;
	usage?: Usage;
}
