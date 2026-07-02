type SessionWaiter = {
	resolve: (release: () => void) => void;
	reject: (e: Error) => void;
};

export class SessionLock {
	private sessions = new Map<string, { locked: boolean; waiters: SessionWaiter[] }>();

	async acquire(sessionId: string): Promise<() => void> {
		let entry = this.sessions.get(sessionId);
		if (!entry) {
			entry = { locked: false, waiters: [] };
			this.sessions.set(sessionId, entry);
		}

		if (!entry.locked) {
			entry.locked = true;
			return () => this.release(sessionId);
		}

		return new Promise((resolve, reject) => {
			entry!.waiters.push({ resolve, reject });
		});
	}

	private release(sessionId: string): void {
		const entry = this.sessions.get(sessionId);
		if (!entry) return;

		const next = entry.waiters.shift();
		if (next) {
			next.resolve(() => this.release(sessionId));
		} else {
			entry.locked = false;
			this.sessions.delete(sessionId);
		}
	}
}

export const sessionLock = new SessionLock();
