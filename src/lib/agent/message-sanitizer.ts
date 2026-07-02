import type { Message, ContentPart } from '$lib/ai';

function extractTextContent(content: string | ContentPart[]): string {
	if (typeof content === 'string') return content;
	return content
		.filter((p) => p.type === 'text')
		.map((p) => p.text)
		.join('\n');
}

function mergeContent(a: string | ContentPart[], b: string | ContentPart[]): string {
	return extractTextContent(a) + '\n\n' + extractTextContent(b);
}

const SURROGATE_RE = /[\uD800-\uDFFF]/g;

function stripSurrogates(text: string): string {
	return text.replace(SURROGATE_RE, '\uFFFD');
}

function cleanContent(content: string | ContentPart[]): string | ContentPart[] {
	if (typeof content === 'string') return stripSurrogates(content);
	return content.map((part) => {
		if (part.type === 'text') {
			return { ...part, text: stripSurrogates(part.text) };
		}
		return part;
	});
}

/**
 * 修复相邻相同角色消息：
 * - 连续 user → 合并为一条（内容拼接）
 * - 连续 assistant（不含 tool_calls）→ 合并
 * - 连续 assistant 其中之一有 tool_calls → 保留两者（tool_calls 不能合并）
 */
function repairRoleAlternation(messages: Message[]): Message[] {
	if (messages.length <= 1) return messages;

	const result: Message[] = [messages[0]];

	for (let i = 1; i < messages.length; i++) {
		const prev = result[result.length - 1];
		const curr = messages[i];

		if (prev.role === curr.role && curr.role === 'user') {
			result[result.length - 1] = {
				role: 'user',
				content: mergeContent(prev.content, curr.content)
			};
		} else if (prev.role === curr.role && curr.role === 'assistant') {
			if (prev.tool_calls || curr.tool_calls) {
				result.push(curr);
			} else {
				result[result.length - 1] = {
					role: 'assistant',
					content: mergeContent(prev.content, curr.content)
				};
			}
		} else {
			result.push(curr);
		}
	}

	return result;
}

/**
 * 移除孤儿 tool 结果：
 * tool role 消息的 tool_call_id 必须在前面的 assistant.tool_calls 中存在。
 */
function stripOrphanToolResults(messages: Message[]): Message[] {
	const activeToolIds = new Set<string>();

	for (const msg of messages) {
		if (msg.role === 'assistant' && msg.tool_calls) {
			for (const tc of msg.tool_calls) {
				activeToolIds.add(tc.id);
			}
		}
	}

	return messages.filter((msg) => {
		if (msg.role !== 'tool') return true;
		if (!msg.tool_call_id) return false;
		return activeToolIds.has(msg.tool_call_id);
	});
}

function stripEmptyMessages(messages: Message[]): Message[] {
	return messages.filter((msg) => {
		const text = extractTextContent(msg.content);
		if (text.trim() === '' && !msg.tool_calls && msg.role !== 'tool') {
			return false;
		}
		return true;
	});
}

/**
 * 消息清洗管道
 *
 * 1. 移除空消息（无内容且无 tool_calls）
 * 2. 清除 Unicode surrogate（\uD800-\uDFFF）
 * 3. 修复角色交替（合并连续 user/assistant）
 * 4. 移除孤儿 tool 结果（无匹配 tool_call_id）
 *
 * 返回新的 Message 数组，不修改原数组。
 */
export function sanitizeMessages(messages: Message[]): Message[] {
	let result = stripEmptyMessages(messages);

	result = result.map((msg) => {
		const cleaned: Message = {
			role: msg.role,
			content: cleanContent(msg.content)
		};

		if (msg.name) cleaned.name = stripSurrogates(msg.name);
		if (msg.tool_call_id) cleaned.tool_call_id = stripSurrogates(msg.tool_call_id);
		if (msg.tool_calls) {
			cleaned.tool_calls = msg.tool_calls.map((tc) => ({
				...tc,
				function: {
					name: stripSurrogates(tc.function.name),
					arguments: stripSurrogates(tc.function.arguments)
				}
			}));
		}

		return cleaned;
	});

	result = repairRoleAlternation(result);
	result = stripOrphanToolResults(result);

	return result;
}
