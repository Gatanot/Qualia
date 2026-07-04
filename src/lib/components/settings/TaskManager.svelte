<script lang="ts">
	import type { ScheduledTask } from '$lib/task';

	let {
		onchange
	}: {
		onchange?: () => void;
	} = $props();

	let tasks: ScheduledTask[] = $state([]);
	let loading = $state(true);

	const statusLabel: Record<string, string> = {
		pending: '等待中',
		running: '执行中',
		completed: '已完成',
		failed: '失败',
		paused: '已暂停'
	};

	const statusColor: Record<string, string> = {
		pending: 'var(--status-pending)',
		running: 'var(--status-running)',
		completed: 'var(--status-done)',
		failed: 'var(--status-error)',
		paused: 'var(--status-unknown)'
	};

	async function loadTasks() {
		try {
			const res = await fetch('/api/tasks');
			const data = await res.json();
			tasks = data.tasks || [];
		} catch {
		} finally {
			loading = false;
		}
	}

	async function doAction(action: string, id: string) {
		try {
			const res = await fetch('/api/tasks', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action, id })
			});
			if (res.ok) {
				await loadTasks();
				onchange?.();
			}
		} catch { /* ignore */ }
	}

	function formatTime(ts: number): string {
		const d = new Date(ts);
		return d.toLocaleString('zh-CN', {
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	$effect(() => {
		loadTasks();
	});
</script>

<section class="section">
	<h2>定时任务</h2>

	{#if loading}
		<div class="empty">加载中...</div>
	{:else if tasks.length === 0}
		<div class="empty">暂无任务。在对话中让 AI 使用 schedule_task 工具创建定时任务。</div>
	{:else}
		<div class="task-list">
			{#each tasks as task (task.id)}
				<div class="task-item" class:completed={task.status === 'completed'} class:failed={task.status === 'failed'}>
					<div class="task-header">
						<div class="task-name">{task.name}</div>
						<span class="task-status" style="color: {statusColor[task.status] || 'var(--status-unknown)'}">
							{statusLabel[task.status] || task.status}
						</span>
					</div>
					<div class="task-meta">
						<span>创建: {formatTime(task.createdAt)}</span>
						<span>计划: {formatTime(task.scheduledAt)}</span>
						{#if task.completedAt}
							<span>完成: {formatTime(task.completedAt)}</span>
						{/if}
					</div>
					<div class="task-prompt">{task.prompt.slice(0, 150)}{task.prompt.length > 150 ? '...' : ''}</div>
					{#if task.result}
						<div class="task-result">{task.result.slice(0, 200)}{task.result.length > 200 ? '...' : ''}</div>
					{/if}
					{#if task.error}
						<div class="task-error">错误: {task.error}</div>
					{/if}
					<div class="task-actions">
						{#if task.status === 'pending'}
							<button class="action-btn" onclick={() => doAction('pause', task.id)}>暂停</button>
						{:else if task.status === 'paused'}
							<button class="action-btn" onclick={() => doAction('resume', task.id)}>恢复</button>
						{/if}
						{#if task.status !== 'running'}
							<button class="action-btn danger" onclick={() => doAction('delete', task.id)}>删除</button>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</section>

<style>
	.section { margin-bottom: 3rem; }

	h2 {
		font-size: var(--text-xl);
		margin: 0 0 1.25rem;
		color: var(--text-primary);
		font-weight: 500;
	}

	.empty {
		padding: 2rem;
		color: var(--text-secondary);
		text-align: center;
		border: 1px dashed var(--border-strong);
		border-radius: var(--radius-xl);
		background: var(--bg-surface);
	}

	.task-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.task-item {
		padding: 1.25rem 1.5rem;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-lg);
		background: var(--bg-surface);
		box-shadow: var(--shadow-xs);
	}

	.task-item.completed {
		opacity: 0.7;
	}

	.task-item.failed {
		border-color: var(--danger-bg);
	}

	.task-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
	}

	.task-name {
		font-weight: 500;
		color: var(--text-primary);
		font-size: var(--text-md);
	}

	.task-status {
		font-size: 0.8rem;
		font-weight: 500;
		padding: 0.15rem 0.6rem;
		border-radius: var(--radius-pill);
		background: var(--bg-page);
	}

	.task-meta {
		display: flex;
		gap: 1rem;
		font-size: 0.8rem;
		color: var(--text-tertiary);
		margin-bottom: 0.4rem;
		flex-wrap: wrap;
	}

	.task-prompt {
		font-size: 0.85rem;
		color: var(--text-secondary);
		line-height: 1.4;
		margin-bottom: 0.3rem;
	}

	.task-result {
		font-size: 0.85rem;
		color: var(--text-primary);
		background: var(--bg-page);
		border-radius: 8px;
		padding: 0.6rem 0.8rem;
		margin-top: 0.5rem;
		line-height: 1.4;
	}

	.task-error {
		font-size: 0.85rem;
		color: #ef4444;
		margin-top: 0.3rem;
	}

	.task-actions {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.75rem;
	}

	.action-btn {
		padding: 0.3rem 0.8rem;
		border: 1px solid var(--border-strong);
		border-radius: 8px;
		background: transparent;
		color: var(--text-secondary);
		font-family: inherit;
		font-size: 0.8rem;
		cursor: pointer;
		transition: background 0.15s var(--ease-out), color 0.15s var(--ease-out);
	}

	.action-btn:hover {
		background: var(--bg-hover);
		color: var(--text-primary);
	}

	.action-btn.danger:hover {
		background: var(--danger-btn-hover-bg);
		color: var(--danger-text);
		border-color: var(--danger-bg);
	}
</style>
