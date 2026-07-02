export interface WorkerTask {
	name: string;
	intervalMs: number;
	fn: () => Promise<void>;
}

interface WorkerState {
	running: boolean;
	timerId: ReturnType<typeof setTimeout> | null;
}

export class BackgroundWorker {
	private tasks = new Map<string, WorkerTask>();
	private states = new Map<string, WorkerState>();
	private started = false;

	schedule(name: string, intervalMs: number, fn: () => Promise<void>): void {
		if (this.tasks.has(name)) {
			throw new Error(`BackgroundWorker: task "${name}" already registered`);
		}
		this.tasks.set(name, { name, intervalMs, fn });
		this.states.set(name, { running: false, timerId: null });

		if (this.started) {
			this.scheduleNext(name);
		}
	}

	start(): void {
		if (this.started) return;
		this.started = true;

		for (const name of this.tasks.keys()) {
			this.scheduleNext(name);
		}
	}

	stop(): void {
		this.started = false;

		for (const [name, state] of this.states) {
			if (state.timerId) {
				clearTimeout(state.timerId);
				state.timerId = null;
			}
			state.running = false;
		}
	}

	private scheduleNext(name: string): void {
		const task = this.tasks.get(name);
		const state = this.states.get(name);
		if (!task || !state) return;

		state.timerId = setTimeout(() => this.execute(name), task.intervalMs);
	}

	private async execute(name: string): Promise<void> {
		const task = this.tasks.get(name);
		const state = this.states.get(name);
		if (!task || !state) return;

		if (state.running) return;
		state.running = true;

		try {
			await task.fn();
		} catch (e) {
			console.error(`[BackgroundWorker] task "${name}" error:`, (e as Error).message);
		} finally {
			state.running = false;
			if (this.started) {
				this.scheduleNext(name);
			}
		}
	}
}
