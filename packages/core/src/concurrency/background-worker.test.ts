import { describe, it, expect, vi } from 'vitest';
import { BackgroundWorker } from './background-worker.js';

describe('BackgroundWorker', () => {
	it('calls scheduled task', async () => {
		const worker = new BackgroundWorker();
		const fn = vi.fn().mockResolvedValue(undefined);

		worker.schedule('test', 10, fn);
		worker.start();

		await vi.waitFor(() => expect(fn).toHaveBeenCalled(), { timeout: 200 });
		worker.stop();
	});

	it('does not re-enter if previous task still running', async () => {
		const worker = new BackgroundWorker();
		let resolve!: () => void;
		const promise = new Promise<void>((r) => { resolve = r; });
		let callCount = 0;
		const fn = vi.fn().mockImplementation(async () => {
			callCount++;
			await promise;
		});

		worker.schedule('test', 5, fn);
		worker.start();

		await vi.waitFor(() => expect(callCount).toBeGreaterThanOrEqual(1), { timeout: 100 });

		// Task should still be running, no re-entry
		expect(callCount).toBe(1);

		resolve();
		await new Promise((r) => setTimeout(r, 20));
		worker.stop();
	});

	it('isolates errors between tasks', async () => {
		const worker = new BackgroundWorker();
		const failFn = vi.fn().mockRejectedValue(new Error('boom'));
		const okFn = vi.fn().mockResolvedValue(undefined);

		worker.schedule('fail', 10, failFn);
		worker.schedule('ok', 10, okFn);
		worker.start();

		await vi.waitFor(() => {
			expect(failFn).toHaveBeenCalled();
			expect(okFn).toHaveBeenCalled();
		}, { timeout: 200 });

		worker.stop();
	});

	it('stop prevents further execution', async () => {
		const worker = new BackgroundWorker();
		const fn = vi.fn().mockResolvedValue(undefined);

		worker.schedule('test', 10, fn);
		worker.start();

		await vi.waitFor(() => expect(fn).toHaveBeenCalled(), { timeout: 200 });

		const countAfterFirst = fn.mock.calls.length;
		worker.stop();

		await new Promise((r) => setTimeout(r, 50));
		expect(fn).toHaveBeenCalledTimes(countAfterFirst);
	});
});
