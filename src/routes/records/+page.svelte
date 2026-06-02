<script lang="ts">
	import { goto } from '$app/navigation';
	import { sessions, loadSessions } from '$lib/session-store';
	import { renderMarkdown } from '$lib/markdown';
	import type { Session } from '$lib/storage';

	const PAGE_SIZE = 20;
	let currentPage = $state(1);

	let totalPages = $derived(Math.max(1, Math.ceil($sessions.length / PAGE_SIZE)));

	let visibleSessions = $derived.by(() => {
		if (currentPage > totalPages) currentPage = totalPages;
		const start = (currentPage - 1) * PAGE_SIZE;
		return $sessions.slice(start, start + PAGE_SIZE);
	});

	$effect(() => {
		loadSessions();
	});

	function goToSession(session: Session) {
		goto('/chat/' + session.id);
	}

	function formatDate(ts: number): string {
		const d = new Date(ts);
		const now = new Date();
		const diff = now.getTime() - d.getTime();

		const timeStr = d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
		if (diff < 86400000) {
			return `今天 ${timeStr}`;
		} else if (diff < 172800000) {
			return `昨天 ${timeStr}`;
		}
		return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }) + ' ' + timeStr;
	}

	function prevPage() {
		if (currentPage > 1) currentPage--;
	}

	function nextPage() {
		if (currentPage < totalPages) currentPage++;
	}
</script>

<div class="records-page">
	<div class="records-inner">
		<header class="records-header">
			<button class="back-btn" onclick={() => history.back()}>
				<span class="material-symbols-rounded">arrow_back</span>
			</button>
			<h1>对话记录</h1>
			<span class="record-count">{visibleSessions.length > 0 ? `${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, $sessions.length)} / ${$sessions.length}` : ''}</span>
		</header>

		{#if $sessions.length === 0}
			<div class="empty-state">
				<span class="material-symbols-rounded empty-icon">chat_bubble</span>
				<p>暂无对话记录</p>
			</div>
		{:else}
			<div class="record-list">
				{#each visibleSessions as session (session.id)}
					<button
						class="record-card"
						onclick={() => goToSession(session)}
					>
						<div class="record-header">
							<span class="record-title">{session.title}</span>
							<span class="record-time">{formatDate(session.updated_at)}</span>
						</div>
						{#if session.summary}
							<div class="record-summary">{@html renderMarkdown(session.summary)}</div>
						{/if}
					</button>
				{/each}
			</div>

			{#if totalPages > 1}
				<div class="pagination">
					<button class="page-btn" disabled={currentPage <= 1} onclick={prevPage}>
						<span class="material-symbols-rounded">chevron_left</span>
					</button>
					<span class="page-info">{currentPage} / {totalPages}</span>
					<button class="page-btn" disabled={currentPage >= totalPages} onclick={nextPage}>
						<span class="material-symbols-rounded">chevron_right</span>
					</button>
				</div>
			{/if}
		{/if}
	</div>
</div>

<style>
	.records-page {
		height: 100%;
		overflow-y: auto;
	}

	.records-inner {
		max-width: 760px;
		margin: 0 auto;
		padding: var(--space-3xl) var(--space-2xl);
	}

	.records-header {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: var(--space-3xl);
	}

	.back-btn {
		width: 40px;
		height: 40px;
		border: none;
		border-radius: var(--radius-full);
		background: transparent;
		color: var(--text-mid);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 0.2s var(--ease-out), color 0.2s var(--ease-out);
	}

	.back-btn:hover {
		background: var(--bg-surface-press);
		color: var(--text-primary);
	}

	h1 {
		font-size: var(--text-3xl);
		color: var(--text-primary);
		font-weight: 500;
		letter-spacing: -0.02em;
		font-family: var(--font-serif);
		margin: 0;
	}

	.record-count {
		margin-left: auto;
		font-size: var(--text-sm);
		color: var(--text-muted);
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		padding: 4rem 0;
		color: var(--text-muted);
	}

	.empty-icon {
		font-size: 48px;
		opacity: 0.4;
	}

	.empty-state p {
		font-size: var(--text-base);
		margin: 0;
	}

	.record-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.record-card {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 1.25rem 1.5rem;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
		background: var(--bg-surface);
		cursor: pointer;
		text-align: left;
		font-family: inherit;
		color: var(--text-primary);
		transition: border-color 0.2s var(--ease-out), background 0.2s var(--ease-out), box-shadow 0.2s var(--ease-out);
		box-shadow: var(--shadow-xs);
	}

	.record-card:hover {
		border-color: var(--border-accent);
		background: var(--bg-surface-hover);
		box-shadow: var(--shadow-sm);
	}

	.record-header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
	}

	.record-title {
		font-size: var(--text-md);
		font-weight: 500;
		color: var(--text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.record-time {
		font-size: var(--text-sm);
		color: var(--text-muted);
		flex-shrink: 0;
	}

	.record-summary {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--text-secondary);
		line-height: var(--leading-relaxed);
	}

	.record-summary :global(p) {
		margin: 0 0 0.5rem;
	}

	.record-summary :global(p:last-child) {
		margin-bottom: 0;
	}

	.record-summary :global(code) {
		font-family: var(--font-mono);
		font-size: 0.85em;
		background: var(--bg-tool);
		padding: 0.15em 0.4em;
		border-radius: 4px;
		color: var(--accent);
	}

	.record-summary :global(ul),
	.record-summary :global(ol) {
		margin: 0.25rem 0;
		padding-left: 1.25rem;
	}

	.record-summary :global(li) {
		margin-bottom: 0.15rem;
	}

	.record-summary :global(strong) {
		font-weight: 600;
		color: var(--text-darker);
	}

	.pagination {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		margin-top: 2rem;
		padding-top: 1.5rem;
		border-top: 1px solid var(--border-subtle);
	}

	.page-btn {
		width: 36px;
		height: 36px;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		background: var(--bg-surface);
		color: var(--text-primary);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 0.2s var(--ease-out), border-color 0.2s var(--ease-out);
	}

	.page-btn:hover:not(:disabled) {
		background: var(--bg-surface-hover);
		border-color: var(--border-accent);
	}

	.page-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.page-info {
		font-size: var(--text-sm);
		color: var(--text-muted);
		font-weight: 500;
		user-select: none;
	}
</style>
