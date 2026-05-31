<script lang="ts">
	let { confirmId, message, onresolve }: {
		confirmId: string;
		message: string;
		onresolve: (confirmId: string, approved: boolean) => void;
	} = $props();
</script>

<div class="confirm-inline">
	<div class="confirm-header">
		<span class="material-symbols-rounded confirm-icon">gavel</span>
		<span class="confirm-label">需要确认操作</span>
	</div>
	<p class="confirm-message">{message}</p>
	<div class="confirm-actions">
		<button class="btn btn-outline" onclick={() => onresolve(confirmId, false)}>
			拒绝
		</button>
		<button class="btn btn-primary" onclick={() => onresolve(confirmId, true)}>
			允许
		</button>
	</div>
</div>

<style>
	.confirm-inline {
		background: var(--warn-bg);
		border: 1px solid var(--warn-border);
		border-radius: 20px;
		padding: 1rem 1.25rem;
		font-size: 0.9rem;
		box-shadow: var(--shadow-sm);
	}

	.confirm-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}

	.confirm-icon {
		font-size: 20px;
		color: var(--warm-accent);
	}

	.confirm-label {
		font-weight: 500;
		color: var(--text-mid);
	}

	.confirm-message {
		margin: 0 0 1rem;
		color: var(--text-primary);
		font-size: 0.95rem;
		line-height: 1.6;
		white-space: pre-wrap;
		word-break: break-word;
	}

	.confirm-actions {
		display: flex;
		gap: 0.75rem;
		justify-content: flex-end;
	}

	.btn {
		padding: 0.5rem 1.5rem;
		border-radius: 100px;
		border: none;
		font-family: inherit;
		font-size: 0.85rem;
		font-weight: 500;
		cursor: pointer;
		transition: transform 0.15s, background-color 0.2s, box-shadow 0.2s;
	}

	.btn:active {
		transform: scale(0.98);
	}

	.btn-primary {
		background: var(--accent);
		color: var(--text-on-accent);
		box-shadow: var(--shadow-accent-btn-active);
	}

	.btn-primary:hover {
		background: var(--accent-hover);
		box-shadow: var(--shadow-accent-btn-hover);
	}

	.btn-outline {
		background: var(--bg-table);
		color: var(--text-mid);
	}

	.btn-outline:hover {
		background: var(--border-input);
	}
</style>
