<script lang="ts">
	let { content = '', done = false }: { content: string; done: boolean } = $props();
	let expanded = $state(false);

	function toggle() {
		expanded = !expanded;
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="reasoning" class:expanded class:done>
	<div class="reasoning-header" onclick={toggle}>
		<span class="reasoning-label">思考过程</span>
		{#if !done}
			<span class="reasoning-dot">●</span>
		{/if}
		<span class="material-symbols-rounded expand-icon">
			{expanded ? 'expand_less' : 'expand_more'}
		</span>
	</div>
	{#if expanded}
		<div class="reasoning-content">{content}</div>
	{/if}
</div>

<style>
	.reasoning {
		background: var(--bg-reasoning);
		border: 1px solid var(--border-accent);
		border-radius: var(--radius-lg);
		font-size: 0.9rem;
		transition: border-color 0.25s var(--ease-out), background 0.25s var(--ease-out);
		overflow: hidden;
	}

	.reasoning.done {
		background: var(--bg-done);
	}

	.reasoning-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.65rem 0.85rem;
		cursor: pointer;
		user-select: none;
		transition: background 0.2s var(--ease-out);
	}

	.reasoning-header:hover {
		background: var(--bg-surface-hover);
	}

	.reasoning-label {
		font-weight: 500;
		color: var(--text-secondary);
		font-size: 0.85rem;
		letter-spacing: 0.02em;
	}

	.reasoning-dot {
		font-size: 8px;
		color: var(--warm-accent);
		animation: pulse 1.2s ease-in-out infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; transform: scale(1); }
		50% { opacity: 0.35; transform: scale(0.85); }
	}

	.expand-icon {
		font-size: 18px;
		color: var(--text-muted);
		margin-left: auto;
		transition: transform 0.25s var(--ease-out);
	}

	.reasoning-content {
		padding: 0 0.85rem 0.85rem;
		color: var(--text-secondary);
		white-space: pre-wrap;
		line-height: var(--leading-relaxed);
		font-style: italic;
		max-height: 300px;
		overflow-y: auto;
		font-size: 0.88rem;
	}

	.reasoning-content::-webkit-scrollbar {
		width: 4px;
	}
	.reasoning-content::-webkit-scrollbar-thumb {
		background-color: var(--scrollbar);
		border-radius: 10px;
	}
</style>
