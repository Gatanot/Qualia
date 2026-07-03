type Waiter = { resolve: () => void; reject: (e: Error) => void };

export class FileMutex {
	private locks = new Map<string, { locked: boolean; waiters: Waiter[] }>();

	async run<T>(key: string, fn: () => Promise<T>): Promise<T> {
		await this.acquire(key);
		try {
			return await fn();
		} finally {
			this.release(key);
		}
	}

	private acquire(key: string): Promise<void> {
		let entry = this.locks.get(key);
		if (!entry) {
			entry = { locked: false, waiters: [] };
			this.locks.set(key, entry);
		}

		if (!entry.locked) {
			entry.locked = true;
			return Promise.resolve();
		}

		return new Promise((resolve, reject) => {
			entry!.waiters.push({ resolve, reject });
		});
	}

	private release(key: string): void {
		const entry = this.locks.get(key);
		if (!entry) return;

		const next = entry.waiters.shift();
		if (next) {
			next.resolve();
		} else {
			entry.locked = false;
			this.locks.delete(key);
		}
	}
}

export const fileMutex = new FileMutex();
