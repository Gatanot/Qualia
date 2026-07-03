import { describe, it, expect } from 'vitest';
import { SessionLock } from './session-lock';

describe('SessionLock', () => {
	it('acquires and releases a session', async () => {
		const lock = new SessionLock();
		const release = await lock.acquire('s1');
		expect(typeof release).toBe('function');
		release();
	});

	it('serializes concurrent acquires on same session', async () => {
		const lock = new SessionLock();
		const order: number[] = [];

		await Promise.all([
			(async () => {
				const release = await lock.acquire('s1');
				order.push(1);
				release();
			})(),
			(async () => {
				const release = await lock.acquire('s1');
				order.push(2);
				release();
			})(),
		]);

		expect(order).toEqual([1, 2]);
	});

	it('throws on double release', async () => {
		const lock = new SessionLock();
		const release = await lock.acquire('s1');
		release();
		expect(() => release()).toThrow('already released');
	});

	it('allows concurrent acquires on different sessions', async () => {
		const lock = new SessionLock();
		const results: string[] = [];

		await Promise.all([
			(async () => {
				const r = await lock.acquire('a');
				results.push('a');
				r();
			})(),
			(async () => {
				const r = await lock.acquire('b');
				results.push('b');
				r();
			})(),
		]);

		expect(results).toHaveLength(2);
	});
});
