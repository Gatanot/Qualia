import { describe, it, expect } from 'vitest';
import { FileMutex } from './file-mutex.js';

describe('FileMutex', () => {
	it('executes a single task', async () => {
		const mutex = new FileMutex();
		const result = await mutex.run('key1', async () => 42);
		expect(result).toBe(42);
	});

	it('serializes concurrent tasks on same key', async () => {
		const mutex = new FileMutex();
		const order: number[] = [];

		await Promise.all([
			mutex.run('k', async () => { order.push(1); return 1; }),
			mutex.run('k', async () => { order.push(2); return 2; }),
			mutex.run('k', async () => { order.push(3); return 3; }),
		]);

		expect(order).toEqual([1, 2, 3]);
	});

	it('runs different keys concurrently', async () => {
		const mutex = new FileMutex();
		const order: number[] = [];

		await Promise.all([
			mutex.run('a', async () => { order.push(1); return 1; }),
			mutex.run('b', async () => { order.push(2); return 2; }),
		]);

		expect(order).toContain(1);
		expect(order).toContain(2);
	});

	it('releases lock on error and allows next task', async () => {
		const mutex = new FileMutex();

		await expect(mutex.run('k', async () => { throw new Error('fail'); })).rejects.toThrow('fail');

		const result = await mutex.run('k', async () => 42);
		expect(result).toBe(42);
	});

	it('supports N concurrent waiters', async () => {
		const mutex = new FileMutex();
		let running = 0;
		let maxRunning = 0;

		const tasks = Array.from({ length: 5 }, (_, i) =>
			mutex.run('k', async () => {
				running++;
				maxRunning = Math.max(maxRunning, running);
				await new Promise((r) => setTimeout(r, 5));
				running--;
				return i;
			})
		);

		await Promise.all(tasks);
		expect(maxRunning).toBe(1);
	});
});
