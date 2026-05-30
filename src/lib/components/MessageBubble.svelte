<script lang="ts">
	import type { UIMessage, ContentBlock } from './types';
	import ToolCallCard from './ToolCallCard.svelte';
	import ConfirmInline from './ConfirmInline.svelte';
	import ReasoningBlock from './ReasoningBlock.svelte';
	import { renderMarkdown } from '$lib/markdown';

	let { message, onconfirm, onrecovery, onrollback }: {
		message: UIMessage;
		onconfirm?: (confirmId: string, approved: boolean) => void;
		onrecovery?: (action: 'retry' | 'rollback') => void;
		onrollback?: (messageId: string) => void;
	} = $props();

	let roleLabel = $derived(
		message.role === 'error' ? '错误' : 'Qualia'
	);

	const htmlCache = new Map<string, string>();
	let rollbackConfirm = $state(false);
	let confirmTimer: ReturnType<typeof setTimeout> | null = null;

	function getUserText(): string {
		return message.blocks
			.filter((b) => b.type === 'text')
			.map((b) => b.content)
			.join('\n');
	}

	async function handleCopy() {
		try {
			await navigator.clipboard.writeText(getUserText());
		} catch {
			// fallback for insecure context
		}
	}

	function handleRollbackClick() {
		if (!rollbackConfirm) {
			rollbackConfirm = true;
			confirmTimer = setTimeout(() => {
				rollbackConfirm = false;
			}, 3000);
		} else {
			if (confirmTimer) clearTimeout(confirmTimer);
			rollbackConfirm = false;
			onrollback?.(message.id);
		}
	}

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
	<div class="message-body">
		{#if message.role !== 'user'}
			<div class="message-role">{roleLabel}</div>
		{/if}

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
			{:else if block.type === 'error_recovery'}
				<div class="error-recovery">
					<p class="recovery-msg">{block.message}</p>
					<div class="recovery-actions">
						<button class="btn-recovery" onclick={() => onrecovery?.('retry')}>
							<span class="material-symbols-rounded">refresh</span>
							重试
						</button>
						<button class="btn-recovery btn-recovery-secondary" onclick={() => onrecovery?.('rollback')}>
							<span class="material-symbols-rounded">undo</span>
							回退
						</button>
					</div>
				</div>
			{/if}
		{/each}

		{#if !message.done}
			<span class="cursor">|</span>
		{/if}

		{#if message.role === 'user' && message.done}
			<div class="msg-actions">
				<button class="action-btn" onclick={handleCopy} title="复制">
					<span class="material-symbols-rounded">content_copy</span>
				</button>
				<button
					class="action-btn"
					class:confirm={rollbackConfirm}
					onclick={handleRollbackClick}
					title="回退到此"
				>
					<span class="material-symbols-rounded">undo</span>
					{#if rollbackConfirm}
						<span class="confirm-label">确认?</span>
					{/if}
				</button>
			</div>
		{/if}
	</div>
</div>

<style>
	.message-row {
		display: flex;
		max-width: 100%;
		margin-bottom: 0.5rem;
	}

	.message-row.user {
		justify-content: flex-end;
	}

	.message-body {
		min-width: 0;
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.message-row.user .message-body {
		align-items: flex-end;
		width: auto;
		max-width: 85%;
	}

	.message-role {
		font-size: 0.85rem;
		font-weight: 500;
		color: #8E857D;
		padding: 0 0.5rem;
		margin-bottom: 0.1rem;
	}

	.message-content {
		background: #FFFFFF;
		border-radius: 4px 24px 24px 24px;
		padding: 1.25rem 1.5rem;
		font-size: 1.05rem;
		line-height: 1.75;
		white-space: pre-wrap;
		word-break: break-word;
		box-shadow: 0 4px 20px rgba(74, 69, 66, 0.04), 0 1px 3px rgba(74, 69, 66, 0.02);
		color: #4A4542;
	}

	.message-row.user .message-content {
		background: #7B8C7C;
		color: #FFFFFF;
		border-radius: 24px 4px 24px 24px;
		box-shadow: 0 4px 20px rgba(123, 140, 124, 0.15), 0 1px 3px rgba(123, 140, 124, 0.1);
	}

	.message-row.error .message-content {
		background: #FCE8E6;
		color: #B71C1C;
		border-radius: 4px 20px 20px 20px;
	}

	/* Markdown rendered overrides */
	.message-content.markdown-body {
		white-space: normal;
	}

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
		background: #F4F1EA;
		padding: 0.2em 0.5em;
		border-radius: 6px;
		color: #7B8C7C;
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
		padding: 0.75rem 1.25rem;
		border-left: 4px solid #7B8C7C;
		background: #F8F6F0;
		border-radius: 0 12px 12px 0;
		color: #8E857D;
		font-style: italic;
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

	.error-recovery {
		background: #FFF9E6;
		border: 1px solid #FFE699;
		border-radius: 12px;
		padding: 1rem 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.recovery-msg {
		margin: 0;
		font-size: 0.9rem;
		color: #706862;
		line-height: 1.5;
	}

	.recovery-actions {
		display: flex;
		gap: 0.5rem;
	}

	.btn-recovery {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.45rem 1rem;
		border: 1px solid rgba(230, 226, 216, 0.6);
		border-radius: 100px;
		background: #FFFFFF;
		color: #3D3834;
		cursor: pointer;
		font-size: 0.85rem;
		font-weight: 500;
		font-family: inherit;
		transition: transform 0.15s, background 0.2s;
	}

	.btn-recovery:hover {
		background: #F0EBE1;
	}

	.btn-recovery:active {
		transform: scale(0.98);
	}

	.btn-recovery-secondary {
		background: #FAF8F5;
	}

	.btn-recovery .material-symbols-rounded {
		font-size: 18px;
	}

	.msg-actions {
		display: flex;
		gap: 0.25rem;
		opacity: 0;
		transition: opacity 0.15s;
		justify-content: flex-end;
	}

	.message-row:hover .msg-actions {
		opacity: 1;
	}

	.action-btn {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.25rem 0.5rem;
		border: none;
		border-radius: 8px;
		background: transparent;
		color: #A39B93;
		cursor: pointer;
		font-family: inherit;
		font-size: 0.8rem;
		transition: background 0.15s, color 0.15s;
	}

	.action-btn:hover {
		background: #F0EBE1;
		color: #3D3834;
	}

	.action-btn.confirm {
		background: #FFF3E0;
		color: #E65100;
	}

	.action-btn .material-symbols-rounded {
		font-size: 16px;
	}

	.confirm-label {
		white-space: nowrap;
	}

	.cursor {
		animation: blink 0.7s infinite;
		font-weight: 700;
		color: #7B8C7C;
	}

	@keyframes blink {
		0%, 100% { opacity: 1; }
		50% { opacity: 0; }
	}
</style>
