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
	<p>随时聆听</p>
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
		animation: fadeSlideUp 0.8s var(--ease-out) forwards;
		opacity: 0;
		user-select: none;
	}

	@keyframes fadeSlideUp {
		from { opacity: 0; transform: translateY(20px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.empty-icon-container {
		width: 120px;
		height: 120px;
		background: var(--bg-done);
		border-radius: var(--radius-full);
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 0.75rem;
		overflow: hidden;
		box-shadow: inset 0 2px 8px rgba(255, 255, 255, 0.5), var(--shadow-md);
		animation: breathe 4s ease-in-out infinite;
	}

	@keyframes breathe {
		0%, 100% { box-shadow: inset 0 2px 8px rgba(255, 255, 255, 0.5), var(--shadow-md); }
		50% { box-shadow: inset 0 2px 8px rgba(255, 255, 255, 0.5), var(--shadow-lg); }
	}

	.empty-icon {
		font-size: 56px;
		color: var(--accent);
		animation: iconFloat 4s ease-in-out infinite;
	}

	@keyframes iconFloat {
		0%, 100% { transform: translateY(0); }
		50% { transform: translateY(-3px); }
	}

	.empty-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		animation: iconFloat 4s ease-in-out infinite;
	}

	.empty-state h2 {
		margin: 0;
		font-family: var(--font-serif);
		font-weight: 700;
		font-size: var(--text-4xl);
		color: var(--text-primary);
		letter-spacing: 0.05em;
	}

	.empty-state p {
		margin: 0;
		font-size: var(--text-lg);
		color: var(--text-secondary);
		font-weight: 400;
		letter-spacing: 0.02em;
	}
</style>
