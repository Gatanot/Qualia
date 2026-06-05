<script lang="ts">
</script>

<button class="plus-btn" aria-label="新建">
	<span class="material-symbols-rounded">add</span>
</button>

<style>
	.plus-btn {
		width: 36px;
		height: 36px;
		border-radius: var(--radius-full);
		border: 1px solid var(--border-accent);
		background: var(--bg-surface);
		color: var(--text-secondary);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s var(--ease-out);
		flex-shrink: 0;
	}

	.plus-btn:hover {
		background: var(--bg-surface-hover);
		color: var(--text-primary);
		border-color: var(--border-hover);
	}

	.plus-btn .material-symbols-rounded {
		font-size: 20px;
	}
</style>
