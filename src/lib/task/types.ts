export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'paused';

export interface ScheduledTask {
	id: string;
	name: string;
	prompt: string;
	createdAt: number;
	scheduledAt: number;
	status: TaskStatus;
	result?: string;
	completedAt?: number;
	error?: string;
}
