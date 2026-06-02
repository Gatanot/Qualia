<script lang="ts">
	import { goto } from '$app/navigation';
	import type { Session } from '$lib/storage';

	let { sessions, open = $bindable(false) } = $props<{
		sessions: Session[];
		open: boolean;
	}>();

	let keyword = $state('');
	let inputEl = $state<HTMLInputElement>();

	function handleSelect(session: Session) {
		open = false;
		goto('/chat/' + session.id);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			if (keyword) {
				keyword = '';
			} else {
				open = false;
			}
		}
	}

	let filtered = $derived.by(() => {
		const kw = keyword.trim().toLowerCase();
		if (!kw) return sessions;
		return sessions.filter((s: Session) => s.title.toLowerCase().includes(kw));
	});

	function formatTime(ts: number): string {
		const d = new Date(ts);
		const now = new Date();
		const diff = now.getTime() - d.getTime();
		if (diff < 86400000) {
			return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
		}
		return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
	}

	$effect(() => {
		if (open) {
			keyword = '';
			requestAnimationFrame(() => inputEl?.focus());
		}
	});
</script>

{#if open}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_interactive_supports_focus -->
	<div class="search-overlay" onclick={() => (open = false)} role="dialog">
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div class="search-panel" onclick={(e: MouseEvent) => e.stopPropagation()} role="document">
			<div class="search-header">
				<span class="material-symbols-rounded search-icon">search</span>
				<input
					bind:this={inputEl}
					class="search-input"
					type="text"
					placeholder="搜索对话标题..."
					bind:value={keyword}
					onkeydown={handleKeydown}
					autocomplete="off"
				/>
				{#if keyword}
					<button class="clear-btn" onclick={() => { keyword = ''; inputEl?.focus(); }}>
						<span class="material-symbols-rounded">close</span>
					</button>
				{/if}
			</div>

			<div class="search-results">
				{#if keyword && filtered.length === 0}
					<div class="empty-hint">未找到匹配的对话</div>
				{:else if !keyword && sessions.length === 0}
					<div class="empty-hint">暂无对话</div>
				{:else}
					{#each filtered as session (session.id)}
						<button
							class="search-item"
							onclick={() => handleSelect(session)}
						>
							<span class="material-symbols-rounded session-icon">chat_bubble</span>
							<div class="session-info">
								<div class="session-title">{session.title}</div>
								<div class="session-time">{formatTime(session.updated_at)}</div>
							</div>
						</button>
					{/each}
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.search-overlay {
		position: fixed;
		inset: 0;
		background: var(--overlay-heavy);
		backdrop-filter: blur(3px);
		-webkit-backdrop-filter: blur(3px);
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding-top: 12vh;
		z-index: 100;
		animation: fadeIn 0.2s var(--ease-out);
	}

	.search-panel {
		width: 100%;
		max-width: 480px;
		max-height: 70vh;
		background: var(--bg-surface);
		border-radius: var(--radius-xl);
		box-shadow: var(--shadow-xl);
		display: flex;
		flex-direction: column;
		overflow: hidden;
		animation: slideDown 0.25s var(--ease-out);
	}

	.search-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 1rem 1.25rem;
		border-bottom: 1px solid var(--border-subtle);
	}

	.search-icon {
		font-size: 20px;
		color: var(--text-muted);
		flex-shrink: 0;
	}

	.search-input {
		flex: 1;
		border: none;
		outline: none;
		font-size: var(--text-base);
		font-family: inherit;
		color: var(--text-primary);
		background: transparent;
	}

	.search-input::placeholder {
		color: var(--text-placeholder);
		font-style: italic;
	}

	.clear-btn {
		width: 28px;
		height: 28px;
		border: none;
		border-radius: var(--radius-full);
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		transition: background 0.2s var(--ease-out), color 0.2s var(--ease-out);
	}

	.clear-btn:hover {
		background: var(--bg-surface-hover);
		color: var(--text-primary);
	}

	.clear-btn .material-symbols-rounded {
		font-size: 18px;
	}

	.search-results {
		flex: 1;
		overflow-y: auto;
		padding: 0.5rem;
		max-height: 50vh;
	}

	.search-results::-webkit-scrollbar {
		width: 4px;
	}

	.search-results::-webkit-scrollbar-thumb {
		background: var(--scrollbar);
		border-radius: 4px;
	}

	.empty-hint {
		padding: 3rem 1rem;
		text-align: center;
		color: var(--text-muted);
		font-size: var(--text-base);
	}

	.search-item {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.7rem 0.85rem;
		border-radius: var(--radius-md);
		cursor: pointer;
		transition: background 0.2s var(--ease-out);
		font-size: var(--text-base);
		color: var(--text-primary);
		background: none;
		border: none;
		width: 100%;
		text-align: left;
		font-family: inherit;
	}

	.search-item:hover {
		background: var(--bg-surface-hover);
	}

	.session-icon {
		font-size: 18px;
		color: var(--text-muted);
		flex-shrink: 0;
	}

	.session-info {
		flex: 1;
		min-width: 0;
	}

	.session-title {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		font-size: 0.92rem;
	}

	.session-time {
		font-size: 0.72rem;
		color: var(--text-muted);
		margin-top: 0.2rem;
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	@keyframes slideDown {
		from { opacity: 0; transform: translateY(-16px) scale(0.97); }
		to { opacity: 1; transform: translateY(0) scale(1); }
	}
</style>
