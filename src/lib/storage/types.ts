import type { ToolCall, Usage } from '$lib/provider';

export interface Session {
	id: string;
	title: string;
	created_at: number;
	updated_at: number;
	parent_id: string | null;
	status: 'active' | 'archived';
	token_count: number;
}

export interface MessageRecord {
	id: string;
	session_id: string;
	role: 'system' | 'user' | 'assistant' | 'tool';
	content: string;
	reasoning_content?: string;
	tool_calls?: ToolCall[];
	tool_call_id?: string;
	name?: string;
	usage?: Usage;
	audio_path?: string;
	created_at: number;
	seq: number;
}

export interface MessageQueryOptions {
	limit?: number;
	before?: number; // seq 小于此值的消息
}

export interface Storage {
	// 会话
	createSession(title?: string): Promise<Session>;
	getSession(id: string): Promise<Session | null>;
	listSessions(): Promise<Session[]>;
	deleteSession(id: string): Promise<void>;
	archiveSession(id: string): Promise<void>;
	forkSession(id: string, summary: string): Promise<Session>;

	// 消息
	addMessage(sessionId: string, message: Omit<MessageRecord, 'id' | 'created_at' | 'seq'>): Promise<MessageRecord>;
	getMessages(sessionId: string, options?: MessageQueryOptions): Promise<MessageRecord[]>;
	getMessage(id: string): Promise<MessageRecord | null>;
	deleteMessage(id: string): Promise<void>;

	// Token 计数
	getTokenCount(sessionId: string): Promise<number>;
	updateTokenCount(sessionId: string, count: number): Promise<void>;

	// TTS 缓存
	setAudioPath(messageId: string, path: string): Promise<void>;
}
