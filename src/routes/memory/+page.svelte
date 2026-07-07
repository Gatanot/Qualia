<script lang="ts">
	import type { Memory } from '$lib/memory/types';

	let memories = $state<Memory[]>([]);
	let loading = $state(true);
	let searchQuery = $state('');
	let typeFilter = $state('');

	const TYPE_LABELS: Record<string, string> = {
		fact: '事实',
		preference: '偏好',
		rule: '规则',
		event: '事件'
	};

	$effect(() => {
		loadMemories();
	});

	async function loadMemories() {
		loading = true;
		const params = new URLSearchParams();
		if (searchQuery) params.set('search', searchQuery);
		if (typeFilter) params.set('type', typeFilter);
		const url = '/api/memory' + (params.toString() ? '?' + params.toString() : '');
		const res = await fetch(url);
		if (res.ok) memories = await res.json();
		loading = false;
	}

	async function archiveMemory(id: string) {
		const res = await fetch('/api/memory', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'archive', id })
		});
		if (res.ok) await loadMemories();
	}

	async function deleteMemory(id: string) {
		if (!confirm('确定要删除这条记忆吗？')) return;
		const res = await fetch('/api/memory', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'delete', id })
		});
		if (res.ok) await loadMemories();
	}

	function onSearchInput(e: Event) {
		searchQuery = (e.target as HTMLInputElement).value;
		loadMemories();
	}
</script>

<svelte:head>
	<title>记忆管理 — Qualia</title>
</svelte:head>

<div class="memory-page">
	<div class="page-header">
		<h1>长期记忆</h1>
		<span class="count">{memories.length} 条</span>
	</div>

	<div class="memory-toolbar">
		<input
			type="text"
			class="search-input"
			placeholder="搜索记忆..."
			value={searchQuery}
			oninput={onSearchInput}
		/>
		<select class="filter-select" bind:value={typeFilter} onchange={() => loadMemories()}>
			<option value="">全部类型</option>
			<option value="fact">事实</option>
			<option value="preference">偏好</option>
			<option value="rule">规则</option>
			<option value="event">事件</option>
		</select>
	</div>

	{#if loading}
		<div class="empty">加载中...</div>
	{:else if memories.length === 0}
		<div class="empty">
			{#if searchQuery || typeFilter}
				没有找到匹配的记忆
			{:else}
				暂无长期记忆<br/>
				<span class="hint">当你在对话中确认 AI 的记忆提议后，记忆会显示在这里</span>
			{/if}
		</div>
	{:else}
		<div class="memory-list">
			{#each memories as m (m.id)}
				<div class="memory-card">
					<div class="card-header">
						<span class="type-badge type-{m.type}">{TYPE_LABELS[m.type] || m.type}</span>
						<span class="confidence">置信度: {m.confidence.toFixed(1)}</span>
						<div class="card-actions">
							<button onclick={() => archiveMemory(m.id)} title="归档">
								<span class="material-symbols-rounded">archive</span>
							</button>
							<button onclick={() => deleteMemory(m.id)} title="删除">
								<span class="material-symbols-rounded">delete</span>
							</button>
						</div>
					</div>
					<div class="card-content">{m.content}</div>
					<div class="card-meta">
						<span>创建: {new Date(m.created_at).toLocaleDateString('zh-CN')}</span>
						{#if m.source_kind !== 'manual'}
							<span>来源: {m.source_kind}</span>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.memory-page {
		max-width: 800px;
		margin: 0 auto;
		padding: var(--space-xl);
	}

	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin-bottom: var(--space-xl);
	}

	.page-header h1 {
		font-size: var(--text-2xl);
		font-weight: 700;
		margin: 0;
	}

	.count {
		font-size: var(--text-sm);
		color: var(--text-mid);
	}

	.memory-toolbar {
		display: flex;
		gap: var(--space-sm);
		margin-bottom: var(--space-lg);
	}

	.search-input {
		flex: 1;
		padding: var(--space-sm) var(--space-md);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		background: var(--bg-surface);
		color: var(--text-primary);
		font-size: var(--text-sm);
		outline: none;
	}

	.search-input:focus {
		border-color: var(--accent);
	}

	.filter-select {
		padding: var(--space-sm) var(--space-md);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		background: var(--bg-surface);
		color: var(--text-primary);
		font-size: var(--text-sm);
		outline: none;
		cursor: pointer;
	}

	.empty {
		text-align: center;
		padding: var(--space-4xl) var(--space-xl);
		color: var(--text-mid);
		font-size: var(--text-md);
	}

	.hint {
		font-size: var(--text-sm);
		color: var(--text-placeholder);
	}

	.memory-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.memory-card {
		background: var(--bg-surface);
		border-radius: var(--radius-md);
		padding: var(--space-lg);
		border: 1px solid var(--border-subtle);
	}

	.card-header {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		margin-bottom: var(--space-sm);
		flex-wrap: wrap;
	}

	.type-badge {
		padding: 2px 8px;
		border-radius: var(--radius-pill);
		font-size: var(--text-xs);
		font-weight: 600;
	}

	.type-fact { background: var(--accent-subtle); color: var(--accent); }
	.type-preference { background: #e8f5e9; color: #2e7d32; }
	.type-rule { background: #fff3e0; color: #e65100; }
	.type-event { background: #e3f2fd; color: #1565c0; }

	:global([data-theme="dark"] .type-preference) { background: #1b3a1e; color: #81c784; }
	:global([data-theme="dark"] .type-rule) { background: #3a2e00; color: #ffa726; }
	:global([data-theme="dark"] .type-event) { background: #0d2b45; color: #64b5f6; }

	.confidence {
		font-size: var(--text-xs);
		color: var(--text-placeholder);
	}

	.card-actions {
		margin-left: auto;
		display: flex;
		gap: 4px;
	}

	.card-actions button {
		width: 28px;
		height: 28px;
		border: none;
		border-radius: var(--radius-full);
		background: transparent;
		color: var(--text-mid);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 16px;
		transition: color 0.2s, background 0.2s;
	}

	.card-actions button:hover {
		color: var(--text-primary);
		background: var(--bg-surface-hover);
	}

	.card-content {
		font-size: var(--text-base);
		line-height: var(--leading-relaxed);
		color: var(--text-primary);
	}

	.card-meta {
		margin-top: var(--space-sm);
		font-size: var(--text-xs);
		color: var(--text-placeholder);
		display: flex;
		gap: var(--space-lg);
	}
</style>
