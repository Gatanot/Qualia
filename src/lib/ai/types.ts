/**
 * 纯文本内容片段
 */
export interface TextContent {
	type: 'text';
	text: string;
}

/**
 * 图片内容片段（base64 或 URL）
 */
export interface ImageContent {
	type: 'image_url';
	image_url: {
		url: string;
		/** 图片分辨率：low / high / auto */
		detail?: 'low' | 'high' | 'auto';
	};
}

/**
 * 多模态消息的内容片段联合类型
 */
export type ContentPart = TextContent | ImageContent;

/**
 * LLM 返回的 tool call 定义
 */
export interface ToolCall {
	/** 本次调用的唯一标识 */
	id: string;
	type: 'function';
	function: {
		/** 工具名称 */
		name: string;
		/** JSON 字符串形式的调用参数 */
		arguments: string;
	};
}

/**
 * 流式响应中的增量 tool call 片段
 */
export interface ToolCallDelta {
	index: number;
	id?: string;
	type?: 'function';
	function?: {
		name?: string;
		arguments?: string;
	};
}

/**
 * 对话消息
 */
export interface Message {
	/** 消息角色 */
	role: 'system' | 'user' | 'assistant' | 'tool';
	/** 消息内容，支持纯文本或多模态 */
	content: string | ContentPart[];
	/** tool 消息的工具名称 */
	name?: string;
	/** tool 消息关联的 tool_call_id */
	tool_call_id?: string;
	/** assistant 消息中 LLM 请求的 tool calls */
	tool_calls?: ToolCall[];
}

/**
 * 工具定义，对应 OpenAI function calling 的 tool 格式
 */
export interface Tool {
	type: 'function';
	function: {
		/** 工具名称 */
		name: string;
		/** 工具描述 */
		description: string;
		/** JSON Schema 参数定义 */
		parameters: Record<string, unknown>;
	};
}

/**
 * 发送给 LLM 的聊天请求参数
 */
export interface ChatRequest {
	/** 消息列表 */
	messages: Message[];
	/** 可用工具定义 */
	tools?: Tool[];
	/** 工具调用策略 */
	tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
	/** 模型名称（覆盖配置中的默认值） */
	model?: string;
	/** 最大输出 token 数 */
	max_tokens?: number;
	/** 采样温度 (0-2) */
	temperature?: number;
}

/**
 * Token 用量统计
 */
export interface Usage {
	/** 提示词 token 数 */
	prompt_tokens: number;
	/** 补全 token 数 */
	completion_tokens: number;
	/** 总 token 数 */
	total_tokens: number;
	/** 提示词缓存命中 token 数 */
	prompt_cache_hit_tokens?: number;
	/** 提示词缓存未命中 token 数 */
	prompt_cache_miss_tokens?: number;
	/** Token 用量明细 */
	completion_tokens_details?: {
		/** 思维链 token 数 */
		reasoning_tokens: number;
	};
}

/**
 * 非流式聊天响应
 */
export interface ChatResponse {
	/** 回复文本内容 */
	content: string | null;
	/** 思维链内容（部分模型支持） */
	reasoning_content?: string;
	/** LLM 请求的 tool calls */
	tool_calls: ToolCall[];
	/** 结束原因 */
	finish_reason: string;
	/** Token 用量 */
	usage?: Usage;
	/** 实际使用的模型名称 */
	model: string;
}

/**
 * 流式响应的单个数据块
 */
export interface StreamChunk {
	/** 增量文本 */
	content: string;
	/** 增量思维链内容 */
	reasoning_content?: string;
	/** 增量 tool call 碎片 */
	tool_calls: ToolCallDelta[];
	/** 结束原因（最后一块非 null） */
	finish_reason: string | null;
	/** Token 用量（通常仅在最后一块出现） */
	usage?: Usage;
}
