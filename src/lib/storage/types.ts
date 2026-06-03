import type { ToolCall, Usage } from '$lib/provider';

/**
 * 会话记录
 */
export interface Session {
	/** 唯一标识 */
	id: string;
	/** 会话标题 */
	title: string;
	/** 创建时间（Unix 毫秒） */
	created_at: number;
	/** 最后更新时间（Unix 毫秒） */
	updated_at: number;
	/** 父会话 ID（分叉场景） */
	parent_id: string | null;
	/** 状态：active / archived */
	status: 'active' | 'archived';
	/** 缓存的全会话 Token 总数 */
	token_count: number;
	/** 会话摘要 */
	summary: string;
	/** 上次生成摘要的时间戳（Unix 毫秒），null 表示从未生成 */
	last_summarized_at: number | null;
	/** 会话创建时 memory.md 的快照 */
	memory_snapshot: string;
}

/**
 * 消息记录
 */
export interface MessageRecord {
	/** 唯一标识 */
	id: string;
	/** 所属会话 ID */
	session_id: string;
	/** 消息角色 */
	role: 'system' | 'user' | 'assistant' | 'tool';
	/** 消息文本内容 */
	content: string;
	/** 思维链内容 */
	reasoning_content?: string;
	/** LLM 请求的 tool calls */
	tool_calls?: ToolCall[];
	/** tool 消息关联的 tool_call_id */
	tool_call_id?: string;
	/** tool 消息对应的工具名 */
	name?: string;
	/** 本条消息的 token 用量 */
	usage?: Usage;
	/** TTS 音频缓存文件路径 */
	audio_path?: string;
	/** 创建时间（Unix 毫秒） */
	created_at: number;
	/** 会话内自增序号 */
	seq: number;
}

/** 消息查询选项 */
export interface MessageQueryOptions {
	/** 返回最近 N 条 */
	limit?: number;
	/** seq 小于此值的消息 */
	before?: number;
}

/**
 * 存储接口
 *
 * MemoryStorage 和 SQLiteStorage 实现此接口。
 * 上层代码通过工厂函数创建，无需关心底层实现。
 */
export interface Storage {
	/** 创建新会话（可选 memory 快照） */
	createSession(title?: string, memorySnapshot?: string): Promise<Session>;
	/** 获取会话 */
	getSession(id: string): Promise<Session | null>;
	/** 列出所有会话（按更新时间倒序） */
	listSessions(): Promise<Session[]>;
	/** 删除会话及其所有消息 */
	deleteSession(id: string): Promise<void>;
	/** 归档会话 */
	archiveSession(id: string): Promise<void>;
	/**
	 * 分叉会话
	 *
	 * 创建新会话，复制父会话全部消息（保持缓存命中），parent_id 指向原会话。
	 */
	forkSession(id: string): Promise<Session>;

	/** 添加消息，自动分配 id / created_at / seq */
	addMessage(sessionId: string, message: Omit<MessageRecord, 'id' | 'created_at' | 'seq'> & { id?: string }): Promise<MessageRecord>;
	/** 查询会话消息 */
	getMessages(sessionId: string, options?: MessageQueryOptions): Promise<MessageRecord[]>;
	/** 按 ID 获取消息 */
	getMessage(id: string): Promise<MessageRecord | null>;
	/** 删除消息 */
	deleteMessage(id: string): Promise<void>;
	/** 删除指定消息及其之后所有消息（用于回退） */
	deleteMessagesFrom(sessionId: string, messageId: string): Promise<void>;

	/** 获取缓存 Token 计数 */
	getTokenCount(sessionId: string): Promise<number>;
	/** 更新缓存 Token 计数 */
	updateTokenCount(sessionId: string, count: number): Promise<void>;

	/** 设置会话标题（不更新 updated_at） */
	setSessionTitle(sessionId: string, title: string): Promise<void>;

	/** 获取超过 idleMs 未活动且需要生成摘要的会话。idleMs 为 null 时返回所有需要摘要的会话 */
	getStaleSessions(idleMs: number | null): Promise<Session[]>;
	/** 获取会话中 seq 大于指定值的消息（用于增量处理） */
	getMessagesSinceSeq(sessionId: string, seq: number): Promise<MessageRecord[]>;
	/** 更新会话摘要 */
	updateSummary(sessionId: string, summary: string): Promise<void>;
	/** 获取今天 last_summarized_at 有变化的会话 */
	getTodayUpdatedSessions(): Promise<Session[]>;
	/** 设置会话的 memory 快照 */
	setMemorySnapshot(sessionId: string, snapshot: string): Promise<void>;

	/** 设置消息的 TTS 音频路径 */
	setAudioPath(messageId: string, path: string): Promise<void>;
}
