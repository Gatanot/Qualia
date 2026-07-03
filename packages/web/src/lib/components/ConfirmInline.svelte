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
		border-radius: var(--radius-xl);
		padding: 1rem 1.25rem;
		font-size: 0.9rem;
		box-shadow: var(--shadow-xs);
		animation: msgEnter 0.3s var(--ease-out) both;
	}

	@keyframes msgEnter {
		from { opacity: 0; transform: translateY(8px); }
		to { opacity: 1; transform: translateY(0); }
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
		font-size: var(--text-base);
		line-height: var(--leading-relaxed);
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
		border-radius: var(--radius-pill);
		border: none;
		font-family: inherit;
		font-size: var(--text-sm);
		font-weight: 500;
		cursor: pointer;
		transition: transform 0.15s var(--ease-out), background-color 0.2s var(--ease-out), box-shadow 0.2s var(--ease-out);
	}

	.btn:active {
		transform: scale(0.97);
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
		color: var(--text-primary);
	}
</style>
