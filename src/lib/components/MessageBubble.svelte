<script lang="ts">
	import type { UIMessage } from './types';
	import ToolCallCard from './ToolCallCard.svelte';
	import ConfirmInline from './ConfirmInline.svelte';
	import ReasoningBlock from './ReasoningBlock.svelte';

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
			{:else if block.type === 'reasoning'}
				<ReasoningBlock content={block.content} done={message.done} />
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
		gap: 1rem;
		max-width: 100%;
		margin-bottom: 0.5rem;
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
		font-size: 20px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
	}

	.message-row:not(.user) .message-avatar {
		background: #F0EBE1; /* Softer neutral background */
		color: #5E7163;      /* Darker sage for contrast */
	}

	.message-row.user .message-avatar {
		background: #5E7163;
		color: #FFFFFF;
	}

	.message-row.error .message-avatar {
		background: #FCE8E6;
		color: #C62828;
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
		font-size: 0.85rem;
		font-weight: 500;
		color: #706862;
		padding: 0 0.25rem;
		margin-bottom: -0.25rem;
	}

	.message-content {
		background: #FFFFFF;
		border-radius: 4px 20px 20px 20px; /* Softer corners */
		padding: 1rem 1.25rem;
		font-size: 1rem; /* Slightly larger for readability */
		line-height: 1.65;
		white-space: pre-wrap;
		word-break: break-word;
		box-shadow: 0 1px 3px rgba(61, 56, 52, 0.05), 0 4px 12px rgba(61, 56, 52, 0.03); /* M3 elevated feel */
		color: #3D3834;
	}

	.message-row.user .message-content {
		background: #5E7163;
		color: #FFFFFF;
		border-radius: 20px 4px 20px 20px;
		box-shadow: 0 1px 3px rgba(94, 113, 99, 0.2), 0 4px 12px rgba(94, 113, 99, 0.1);
	}

	.message-row.error .message-content {
		background: #FCE8E6;
		color: #B71C1C;
		border-radius: 4px 20px 20px 20px;
	}

	.cursor {
		animation: blink 0.7s infinite;
		font-weight: 700;
		color: #5E7163;
	}

	@keyframes blink {
		0%, 100% { opacity: 1; }
		50% { opacity: 0; }
	}
</style>
