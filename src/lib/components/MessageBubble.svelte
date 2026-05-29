<script lang="ts">
	import type { UIMessage } from './types';
	import ToolCallCard from './ToolCallCard.svelte';
	import ConfirmInline from './ConfirmInline.svelte';

	let { message, onconfirm }: {
		message: UIMessage;
		onconfirm?: (confirmId: string, approved: boolean) => void;
	} = $props();

	let avatarIcon = $derived(
		message.role === 'user' ? 'person' :
		message.role === 'error' ? 'error' :
		'spa'
	);

	let roleLabel = $derived(
		message.role === 'user' ? '你' :
		message.role === 'error' ? '错误' :
		'Qualia'
	);


	function handleConfirm(confirmId: string, approved: boolean) {
		onconfirm?.(confirmId, approved);
	}
</script>

<div class="message-row" class:user={message.role === 'user'} class:error={message.role === 'error'}>
	<div class="message-avatar">
		<span class="material-symbols-rounded">{avatarIcon}</span>
	</div>
	<div class="message-body">
		<div class="message-role">{roleLabel}</div>

		{#each message.blocks as block, i (i)}
			{#if block.type === 'text'}
				<div class="message-content">{block.content}</div>
			{:else if block.type === 'tool'}
				<ToolCallCard name={block.name} args={block.args} result={block.result} />
			{:else if block.type === 'confirm'}
			<ConfirmInline
				confirmId={block.confirmId}
				message={block.message}
				onresolve={handleConfirm}
			/>
			{/if}
		{/each}

		{#if !message.done}
			<span class="cursor">|</span>
		{/if}
	</div>
</div>

<style>
	.message-row {
		display: flex;
		gap: 0.75rem;
		max-width: 100%;
	}

	.message-row.user {
		flex-direction: row-reverse;
	}

	.message-avatar {
		flex-shrink: 0;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 22px;
	}

	.message-row:not(.user) .message-avatar {
		background: #F4EFE6;
		color: #6B7F72;
	}

	.message-row.user .message-avatar {
		background: #6B7F72;
		color: #fff;
	}

	.message-row.error .message-avatar {
		background: #FDECEA;
		color: #D32F2F;
	}

	.message-body {
		min-width: 0;
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.message-row.user .message-body {
		align-items: flex-end;
	}

	.message-role {
		font-size: 0.8rem;
		font-weight: 500;
		color: #8C847D;
		padding: 0 0.25rem;
	}

	.message-content {
		background: #fff;
		border-radius: 4px 24px 24px 24px;
		padding: 0.85rem 1.25rem;
		font-size: 0.95rem;
		line-height: 1.6;
		white-space: pre-wrap;
		word-break: break-word;
		box-shadow: 0 2px 12px rgba(74, 67, 62, 0.04);
		color: #4A433E;
	}

	.message-row.user .message-content {
		background: #6B7F72;
		color: #fff;
		border-radius: 24px 4px 24px 24px;
	}

	.message-row.error .message-content {
		background: #FDECEA;
		color: #C62828;
		border-radius: 4px 24px 24px 24px;
	}

	.cursor {
		animation: blink 0.7s infinite;
		font-weight: 700;
		color: #6B7F72;
	}

	@keyframes blink {
		0%, 100% { opacity: 1; }
		50% { opacity: 0; }
	}
</style>
