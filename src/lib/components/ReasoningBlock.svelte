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
		background: #F8F6F0;
		border: 1px solid rgba(215, 210, 200, 0.6);
		border-radius: 16px;
		font-size: 0.9rem;
		transition: border-color 0.2s, background 0.2s;
		overflow: hidden;
	}

	.reasoning.done {
		background: #F2EEE5;
	}

	.reasoning-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.6rem 0.85rem;
		cursor: pointer;
		user-select: none;
	}

	.reasoning-icon {
		font-size: 18px;
		color: #8E857D;
	}

	.reasoning-label {
		font-weight: 500;
		color: #8E857D;
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
		color: #A39B93;
		margin-left: auto;
	}

	.reasoning-content {
		padding: 0 0.85rem 0.85rem;
		color: #8E857D;
		white-space: pre-wrap;
		line-height: 1.6;
		font-style: italic;
		max-height: 300px;
		overflow-y: auto;
	}
	
	.reasoning-content::-webkit-scrollbar {
		width: 4px;
	}
	.reasoning-content::-webkit-scrollbar-thumb {
		background-color: rgba(166, 155, 147, 0.3);
		border-radius: 10px;
	}
</style>
