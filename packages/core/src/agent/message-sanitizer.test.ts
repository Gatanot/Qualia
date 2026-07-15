import { describe, it, expect } from 'vitest';
import { sanitizeMessages } from './message-sanitizer.js';
import type { Message } from '../ai/index.js';

function msg(role: Message['role'], content: string, extra?: Partial<Message>): Message {
	return { role, content, ...extra };
}

describe('sanitizeMessages', () => {
	it('strips empty non-tool messages', () => {
		const input: Message[] = [
			msg('system', 'sys'),
			msg('user', ''),
			msg('assistant', 'hello'),
		];
		const result = sanitizeMessages(input);
		expect(result).toHaveLength(2);
		expect(result[0].role).toBe('system');
		expect(result[1].role).toBe('assistant');
	});

	it('keeps tool messages even when empty', () => {
		const input: Message[] = [
			msg('system', 's'),
			msg('assistant', '', { tool_calls: [{ id: '1', type: 'function', function: { name: 'x', arguments: '{}' } }] }),
			msg('tool', '', { tool_call_id: '1', name: 'x' }),
		];
		const result = sanitizeMessages(input);
		expect(result).toHaveLength(3);
	});

	it('strips surrogate characters', () => {
		const input: Message[] = [
			msg('system', 'sys'),
			msg('user', 'hello \uD800 world'),
		];
		const result = sanitizeMessages(input);
		expect(result[1].content).toBe('hello \uFFFD world');
	});

	it('preserves valid surrogate pairs (emoji / non-BMP)', () => {
		const input: Message[] = [
			msg('system', 'sys'),
			msg('user', 'hi 😀 测试𝠀 end'),
		];
		const result = sanitizeMessages(input);
		expect(result[1].content).toBe('hi 😀 测试𝠀 end');
	});

	it('strips lone low surrogate but keeps adjacent valid pair', () => {
		const input: Message[] = [
			msg('system', 'sys'),
			msg('user', '😀\uDC00x'),
		];
		const result = sanitizeMessages(input);
		expect(result[1].content).toBe('😀\uFFFDx');
	});

	it('merges consecutive user messages', () => {
		const input: Message[] = [
			msg('system', 'sys'),
			msg('user', 'first'),
			msg('user', 'second'),
		];
		const result = sanitizeMessages(input);
		expect(result).toHaveLength(2);
		expect(result[1].content).toContain('first');
		expect(result[1].content).toContain('second');
	});

	it('merges consecutive assistant messages without tool_calls', () => {
		const input: Message[] = [
			msg('system', 'sys'),
			msg('user', 'q'),
			msg('assistant', 'part1'),
			msg('assistant', 'part2'),
		];
		const result = sanitizeMessages(input);
		expect(result).toHaveLength(3);
		expect(result[2].content).toBe('part1\n\npart2');
	});

	it('keeps consecutive assistants if either has tool_calls', () => {
		const input: Message[] = [
			msg('system', 'sys'),
			msg('user', 'q'),
			msg('assistant', 'a1', { tool_calls: [{ id: '1', type: 'function', function: { name: 'x', arguments: '{}' } }] }),
			msg('assistant', 'a2'),
		];
		const result = sanitizeMessages(input);
		expect(result).toHaveLength(4);
	});

	it('strips orphan tool results without matching tool_call_id', () => {
		const input: Message[] = [
			msg('system', 'sys'),
			msg('user', 'q'),
			msg('assistant', '', { tool_calls: [{ id: '1', type: 'function', function: { name: 'x', arguments: '{}' } }] }),
			msg('tool', 'result1', { tool_call_id: '1', name: 'x' }),
			msg('tool', 'orphan', { tool_call_id: '2', name: 'y' }),
		];
		const result = sanitizeMessages(input);
		expect(result).toHaveLength(4);
		const toolMsgs = result.filter(m => m.role === 'tool');
		expect(toolMsgs).toHaveLength(1);
		expect((toolMsgs[0] as any).content).toBe('result1');
	});

	it('strips tool results without tool_call_id', () => {
		const input: Message[] = [
			msg('system', 'sys'),
			msg('tool', 'orphan'),
		];
		const result = sanitizeMessages(input);
		expect(result).toHaveLength(1);
	});

	it('returns new array without mutating input', () => {
		const input: Message[] = [
			msg('system', 'sys'),
			msg('user', 'first'),
			msg('user', 'second'),
		];
		const result = sanitizeMessages(input);
		expect(input).toHaveLength(3);
		expect(result).toHaveLength(2);
	});

	it('cleans surrogates in tool_calls arguments', () => {
		const input: Message[] = [
			msg('system', 'sys'),
			msg('assistant', '', {
				tool_calls: [{ id: '1', type: 'function', function: { name: 'x', arguments: '{"key":"\uD800"}' } }]
			}),
		];
		const result = sanitizeMessages(input);
		expect(result[1].tool_calls![0].function.arguments).toBe('{"key":"\uFFFD"}');
	});
});
