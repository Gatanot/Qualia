import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import type { ScheduledTask, TaskStatus } from './types';

const MAX_TASKS = 100;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function getPath(): string {
	return join(process.cwd(), 'data', 'tasks.json');
}

function readAll(): ScheduledTask[] {
	const path = getPath();
	if (!existsSync(path)) return [];

	try {
		const raw = readFileSync(path, 'utf-8');
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed as ScheduledTask[];
	} catch {
		return [];
	}
}

function writeAll(tasks: ScheduledTask[]): void {
	const path = getPath();
	const dir = join(path, '..');
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

	const now = Date.now();
	const pruned = tasks
		.filter((t) => t.status === 'pending' || t.status === 'running' || t.status === 'paused' || (now - t.createdAt < MAX_AGE_MS))
		.slice(-MAX_TASKS);

	const tmpPath = path + '.tmp';
	writeFileSync(tmpPath, JSON.stringify(pruned, null, '\t'), 'utf-8');
	renameSync(tmpPath, path);
}

export function createTask(name: string, prompt: string, scheduledAt: number): ScheduledTask {
	const task: ScheduledTask = {
		id: crypto.randomUUID(),
		name,
		prompt,
		createdAt: Date.now(),
		scheduledAt,
		status: 'pending'
	};

	const all = readAll();
	all.push(task);
	writeAll(all);
	return task;
}

export function getAllTasks(): ScheduledTask[] {
	return readAll().sort((a, b) => b.createdAt - a.createdAt);
}

export function getPendingTasks(): ScheduledTask[] {
	return readAll().filter((t) => t.status === 'pending' && t.scheduledAt <= Date.now());
}

export function getTask(id: string): ScheduledTask | undefined {
	return readAll().find((t) => t.id === id);
}

export function updateTaskStatus(id: string, status: TaskStatus, extra?: { result?: string; error?: string }): boolean {
	const all = readAll();
	const task = all.find((t) => t.id === id);
	if (!task) return false;

	task.status = status;
	if (status === 'completed') {
		task.completedAt = Date.now();
		task.result = extra?.result;
	}
	if (status === 'failed') {
		task.completedAt = Date.now();
		task.error = extra?.error;
	}

	writeAll(all);
	return true;
}

export function pauseTask(id: string): boolean {
	const all = readAll();
	const task = all.find((t) => t.id === id);
	if (!task || task.status !== 'pending') return false;

	task.status = 'paused';
	writeAll(all);
	return true;
}

export function resumeTask(id: string): boolean {
	const all = readAll();
	const task = all.find((t) => t.id === id);
	if (!task || task.status !== 'paused') return false;

	task.status = 'pending';
	writeAll(all);
	return true;
}

export function deleteTask(id: string): boolean {
	const all = readAll();
	const idx = all.findIndex((t) => t.id === id);
	if (idx === -1) return false;

	all.splice(idx, 1);
	writeAll(all);
	return true;
}

export function formatTasksForAI(tasks: ScheduledTask[]): string {
	if (tasks.length === 0) return '暂无任务。';

	const statusLabel: Record<string, string> = {
		pending: '等待中',
		running: '执行中',
		completed: '已完成',
		failed: '失败',
		paused: '已暂停'
	};

	return tasks.map((t) => {
		const created = new Date(t.createdAt).toISOString().replace('T', ' ').slice(0, 19);
		const scheduled = new Date(t.scheduledAt).toISOString().replace('T', ' ').slice(0, 19);
		let entry = `## ${t.name}\n`;
		entry += `- ID: ${t.id.slice(0, 8)}\n`;
		entry += `- 状态: ${statusLabel[t.status] || t.status}\n`;
		entry += `- 创建时间: ${created}\n`;
		entry += `- 计划执行: ${scheduled}\n`;
		if (t.prompt) entry += `- 任务描述: ${t.prompt.slice(0, 200)}${t.prompt.length > 200 ? '...' : ''}\n`;
		if (t.result) entry += `- 执行结果: ${t.result.slice(0, 500)}${t.result.length > 500 ? '...' : ''}\n`;
		if (t.error) entry += `- 错误: ${t.error.slice(0, 200)}\n`;
		if (t.completedAt) {
			const comp = new Date(t.completedAt).toISOString().replace('T', ' ').slice(0, 19);
			entry += `- 完成时间: ${comp}\n`;
		}
		return entry;
	}).join('\n');
}
