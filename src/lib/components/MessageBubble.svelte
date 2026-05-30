<script lang="ts">
	import type { UIMessage, ContentBlock } from './types';
	import ToolCallCard from './ToolCallCard.svelte';
	import ConfirmInline from './ConfirmInline.svelte';
	import ReasoningBlock from './ReasoningBlock.svelte';
	import { renderMarkdown } from '$lib/markdown';

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

	const htmlCache = new Map<string, string>();

	function getBlockHtml(content: string): string {
		const cached = htmlCache.get(content);
		if (cached) return cached;
		const html = renderMarkdown(content);
		htmlCache.set(content, html);
		return html;
	}

	function isLiveBlock(block: ContentBlock, i: number): boolean {
		if (block.type !== 'text') return false;
		if (message.done) return false;
		return i === message.blocks.length - 1;
	}

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
				{#if isLiveBlock(block, i)}
					<div class="message-content">{block.content}</div>
				{:else}
					<div class="message-content markdown-body">{@html getBlockHtml(block.content)}</div>
				{/if}
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
		background: #F0EBE1;
		color: #5E7163;
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
		border-radius: 4px 20px 20px 20px;
		padding: 1rem 1.25rem;
		font-size: 1rem;
		line-height: 1.65;
		white-space: pre-wrap;
		word-break: break-word;
		box-shadow: 0 1px 3px rgba(61, 56, 52, 0.05), 0 4px 12px rgba(61, 56, 52, 0.03);
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

	/* Markdown rendered overrides — strip bubble chrome for richer layout */
	.message-content.markdown-body {
		white-space: normal;
	}

	/* ---- markdown elements inside rendered content ---- */

	.markdown-body :global(h1),
	.markdown-body :global(h2),
	.markdown-body :global(h3),
	.markdown-body :global(h4),
	.markdown-body :global(h5),
	.markdown-body :global(h6) {
		margin: 1.25rem 0 0.5rem;
		line-height: 1.3;
		color: inherit;
	}
	.markdown-body :global(h1) { font-size: 1.4rem; }
	.markdown-body :global(h2) { font-size: 1.25rem; }
	.markdown-body :global(h3) { font-size: 1.1rem; }

	.markdown-body :global(p) {
		margin: 0 0 0.75rem;
	}
	.markdown-body :global(p:last-child) {
		margin-bottom: 0;
	}

	.markdown-body :global(ul),
	.markdown-body :global(ol) {
		margin: 0 0 0.75rem;
		padding-left: 1.5rem;
	}
	.markdown-body :global(li) {
		margin-bottom: 0.25rem;
	}

	:global(.markdown-body code:not(pre code)) {
		font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace;
		font-size: 0.88em;
		background: #F0EBE1;
		padding: 0.15em 0.4em;
		border-radius: 6px;
		color: #5E7163;
		font-weight: 500;
	}

	:global(.message-row.user .markdown-body code:not(pre code)) {
		background: rgba(255, 255, 255, 0.15);
		color: #E8E3D9;
	}

	.markdown-body :global(pre) {
		margin: 0.75rem 0;
		padding: 1rem;
		border-radius: 12px;
		background: #2D2A27;
		overflow-x: auto;
		position: relative;
	}

	.markdown-body :global(pre code.hljs) {
		font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace;
		font-size: 0.88rem;
		line-height: 1.55;
		background: none;
		padding: 0;
		color: #E6DCCE;
	}

	.markdown-body :global(.code-lang) {
		position: absolute;
		top: 0.5rem;
		right: 0.75rem;
		font-size: 0.72rem;
		color: rgba(230, 220, 206, 0.45);
		font-family: inherit;
		pointer-events: none;
	}

	.message-row.user .markdown-body :global(pre) {
		background: rgba(0, 0, 0, 0.2);
	}

	.markdown-body :global(blockquote) {
		margin: 0.75rem 0;
		padding: 0.5rem 1rem;
		border-left: 3px solid #6B7F72;
		background: #F5F2EB;
		border-radius: 0 8px 8px 0;
		color: #706862;
	}

	.markdown-body :global(blockquote:last-child) {
		margin-bottom: 0;
	}

	.message-row.user .markdown-body :global(blockquote) {
		border-left-color: rgba(255, 255, 255, 0.3);
		background: rgba(255, 255, 255, 0.08);
		color: #E8E3D9;
	}

	.markdown-body :global(table) {
		border-collapse: collapse;
		margin: 0.75rem 0;
		width: 100%;
		font-size: 0.92rem;
	}

	.markdown-body :global(th) {
		background: #F0EBE1;
		padding: 0.5rem 0.75rem;
		text-align: left;
		font-weight: 500;
		border-bottom: 2px solid #E6E2D8;
	}

	.markdown-body :global(td) {
		padding: 0.5rem 0.75rem;
		border-bottom: 1px solid #F0EBE1;
	}

	.markdown-body :global(a) {
		color: #5E7163;
		text-decoration: underline;
	}

	.message-row.user .markdown-body :global(a) {
		color: #E8E3D9;
	}

	.markdown-body :global(hr) {
		border: none;
		border-top: 1px solid #E6E2D8;
		margin: 1rem 0;
	}

	.markdown-body :global(strong) {
		font-weight: 600;
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
