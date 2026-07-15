import { describe, it, expect } from 'vitest';
import { SessionLock } from './session-lock.js';

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

	it('rejects waiter after timeout', async () => {
		const lock = new SessionLock();
		const release = await lock.acquire('s1');

		await expect(lock.acquire('s1', 20)).rejects.toThrow('超时');

		release();
		const release2 = await lock.acquire('s1');
		release2();
	});

	it('waiter with timeout still acquires when released in time', async () => {
		const lock = new SessionLock();
		const release = await lock.acquire('s1');

		const pending = lock.acquire('s1', 1000);
		release();

		const release2 = await pending;
		release2();
	});
});
