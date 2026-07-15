type SessionWaiter = {
	resolve: (release: () => void) => void;
	reject: (e: Error) => void;
};

export class SessionLock {
	private sessions = new Map<string, { locked: boolean; waiters: SessionWaiter[] }>();

	private createRelease(sessionId: string): () => void {
		let released = false;
		return () => {
			if (released) throw new Error(`SessionLock: session "${sessionId}" already released`);
			released = true;
			this.release(sessionId);
		};
	}

	async acquire(sessionId: string, timeoutMs?: number): Promise<() => void> {
		let entry = this.sessions.get(sessionId);
		if (!entry) {
			entry = { locked: false, waiters: [] };
			this.sessions.set(sessionId, entry);
		}

		if (!entry.locked) {
			entry.locked = true;
			return this.createRelease(sessionId);
		}

		return new Promise((resolve, reject) => {
			const waiter: SessionWaiter = { resolve, reject };
			entry!.waiters.push(waiter);

			if (timeoutMs !== undefined) {
				const timer = setTimeout(() => {
					const idx = entry!.waiters.indexOf(waiter);
					if (idx !== -1) {
						entry!.waiters.splice(idx, 1);
						reject(new Error(`SessionLock: acquire "${sessionId}" 超时（${timeoutMs}ms）`));
					}
				}, timeoutMs);
				waiter.resolve = (release) => {
					clearTimeout(timer);
					resolve(release);
				};
			}
		});
	}

	private release(sessionId: string): void {
		const entry = this.sessions.get(sessionId);
		if (!entry) return;

		const next = entry.waiters.shift();
		if (next) {
			next.resolve(this.createRelease(sessionId));
		} else {
			entry.locked = false;
			this.sessions.delete(sessionId);
		}
	}
}

export const sessionLock = new SessionLock();
