export interface TextContent {
	type: 'text';
	text: string;
}

export interface ImageContent {
	type: 'image_url';
	image_url: {
		url: string;
		detail?: 'low' | 'high' | 'auto';
	};
}

export type ContentPart = TextContent | ImageContent;

export interface ToolCall {
	id: string;
	type: 'function';
	function: {
		name: string;
		arguments: string;
	};
}

export interface ToolCallDelta {
	index: number;
	id?: string;
	type?: 'function';
	function?: {
		name?: string;
		arguments?: string;
	};
}

export interface Message {
	role: 'system' | 'user' | 'assistant' | 'tool';
	content: string | ContentPart[];
	name?: string;
	tool_call_id?: string;
	tool_calls?: ToolCall[];
}

export interface Tool {
	type: 'function';
	function: {
		name: string;
		description: string;
		parameters: Record<string, unknown>;
	};
}

export interface ChatRequest {
	messages: Message[];
	tools?: Tool[];
	tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
	model?: string;
	max_tokens?: number;
	temperature?: number;
}

export interface Usage {
	prompt_tokens: number;
	completion_tokens: number;
	total_tokens: number;
	prompt_cache_hit_tokens?: number;
	prompt_cache_miss_tokens?: number;
	completion_tokens_details?: {
		reasoning_tokens: number;
	};
}

export interface ChatResponse {
	content: string | null;
	reasoning_content?: string;
	tool_calls: ToolCall[];
	finish_reason: string;
	usage?: Usage;
	model: string;
}

export interface StreamChunk {
	content: string;
	reasoning_content?: string;
	tool_calls: ToolCallDelta[];
	finish_reason: string | null;
	usage?: Usage;
}
