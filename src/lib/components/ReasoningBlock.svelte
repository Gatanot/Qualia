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
		<span class="material-symbols-rounded reasoning-icon">psychology</span>
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
		background: #F8F4EC;
		border: 1px solid #E8E0D4;
		border-radius: 12px;
		font-size: 0.82rem;
		transition: border-color 0.2s, background 0.2s;
	}

	.reasoning.done {
		background: #F4EFE6;
	}

	.reasoning-header {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.5rem 0.75rem;
		cursor: pointer;
		user-select: none;
	}

	.reasoning-icon {
		font-size: 18px;
		color: #C4A265;
	}

	.reasoning-label {
		font-weight: 500;
		color: #6D645D;
	}

	.reasoning-dot {
		font-size: 8px;
		color: #D4A373;
		animation: pulse 1s infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.3; }
	}

	.expand-icon {
		font-size: 18px;
		color: #A69E96;
		margin-left: auto;
	}

	.reasoning-content {
		padding: 0 0.75rem 0.75rem;
		color: #8C847D;
		white-space: pre-wrap;
		line-height: 1.5;
		font-style: italic;
		max-height: 300px;
		overflow-y: auto;
	}
</style>
