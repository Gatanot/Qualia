<script lang="ts">
	let { customIcon = false }: { customIcon?: boolean } = $props();
</script>

<div class="empty-state">
	<div class="empty-icon-container">
		{#if customIcon}
			<img src="/api/brand-icon" alt="头像" class="empty-img" />
		{:else}
			<span class="material-symbols-rounded empty-icon">spa</span>
		{/if}
	</div>
	<h2>Qualia</h2>
	<p>你的虚拟伙伴，随时倾听</p>
</div>

<style>
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		flex: 1;
		color: var(--text-secondary);
		gap: 0.75rem;
		animation: fadeIn 1s cubic-bezier(0.2, 0, 0, 1) forwards;
		opacity: 0;
	}

	@keyframes fadeIn {
		from { opacity: 0; transform: translateY(15px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.empty-icon-container {
		width: 110px;
		height: 110px;
		background: var(--bg-done);
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 0.75rem;
		overflow: hidden;
		box-shadow: inset 0 4px 8px rgba(255, 255, 255, 0.6), 0 8px 24px rgba(61, 56, 52, 0.06);
	}

	.empty-icon {
		font-size: 52px;
		color: var(--accent);
	}

	.empty-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.empty-state h2 {
		margin: 0;
		font-weight: 300;
		font-size: 2.25rem;
		color: var(--text-primary);
		letter-spacing: 0.04em;
	}

	.empty-state p {
		margin: 0;
		font-size: 1.15rem;
		color: var(--text-secondary);
		font-weight: 400;
	}
</style>
