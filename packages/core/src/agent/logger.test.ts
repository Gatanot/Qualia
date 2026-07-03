import { describe, it, expect, vi } from 'vitest';
import { AgentLogger } from './logger.js';

describe('AgentLogger', () => {
	it('implements LoopHooks without errors', async () => {
		const logger = new AgentLogger('test-session-123');
		const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

		const msgs = await logger.beforeLlmCall([{ role: 'system', content: 'hello' }]);
		expect(msgs).toHaveLength(1);

		await logger.afterLlmCall({ prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 });

		const args = await logger.beforeToolExecution('read_file', { path: '/tmp/test' });
		expect(args.path).toBe('/tmp/test');

		await logger.afterToolExecution('read_file', { success: true, output: 'content' });

		await logger.onConfirmRequired({ toolName: 'delete_file', reason: '确认删除？' }, 'confirm-1');

		await logger.onLlmRetry(1, 5, new Error('timeout'));

		await logger.afterTurn(0);

		expect(spy).toHaveBeenCalled();
		spy.mockRestore();
	});

	it('includes session prefix in log output', async () => {
		const logger = new AgentLogger('abcdef12-1234-5678');
		const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

		await logger.beforeLlmCall([]);
		const firstLog = spy.mock.calls[0]?.[0] as string;
		expect(firstLog).toContain('abcdef12');

		spy.mockRestore();
	});
});
