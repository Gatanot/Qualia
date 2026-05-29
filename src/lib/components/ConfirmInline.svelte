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
		background: #FFF8E1;
		border: 1px solid #FFE082;
		border-radius: 16px;
		padding: 0.85rem 1rem;
		font-size: 0.85rem;
	}

	.confirm-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}

	.confirm-icon {
		font-size: 20px;
		color: #D4A373;
	}

	.confirm-label {
		font-weight: 500;
		color: #6D645D;
	}

	.confirm-message {
		margin: 0 0 0.75rem;
		color: #4A433E;
		font-size: 0.85rem;
		line-height: 1.5;
		white-space: pre-wrap;
		word-break: break-word;
	}

	.confirm-actions {
		display: flex;
		gap: 0.5rem;
	}

	.btn {
		padding: 0.4rem 1.25rem;
		border-radius: 100px;
		border: none;
		font-family: inherit;
		font-size: 0.82rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn-primary {
		background: #6B7F72;
		color: #fff;
	}

	.btn-primary:hover {
		background: #5A6B60;
	}

	.btn-outline {
		background: #F4EFE6;
		color: #6D645D;
	}

	.btn-outline:hover {
		background: #EAE4DC;
	}
</style>
