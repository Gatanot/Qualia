<script lang="ts">
	import type { UIMessage, ContentBlock } from './types';
	import ToolCallCard from './ToolCallCard.svelte';
	import ConfirmInline from './ConfirmInline.svelte';
	import ReasoningBlock from './ReasoningBlock.svelte';
	import { renderMarkdown } from '$lib/markdown';

	let { message, onconfirm, onrecovery, onrollback, onfork, onedit }: {
		message: UIMessage;
		onconfirm?: (confirmId: string, approved: boolean) => void;
		onrecovery?: (action: 'retry' | 'rollback') => void;
		onrollback?: (messageId: string) => void;
		onfork?: (messageId: string) => void;
		onedit?: (messageId: string, content: string) => void;
	} = $props();

	let roleLabel = $derived(
		message.role === 'error' ? '错误' : 'Qualia'
	);

	const htmlCache = new Map<string, string>();
	let rollbackConfirm = $state(false);
	let confirmTimer: ReturnType<typeof setTimeout> | null = null;
	let editing = $state(false);
	let editText = $state('');

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

	function handleFork() {
		onfork?.(message.id);
	}

	function handleEditStart() {
		editText = getUserText();
		editing = true;
	}

	function handleEditCancel() {
		editing = false;
		editText = '';
	}

	function handleEditSubmit() {
		const text = editText.trim();
		if (!text) return;
		editing = false;
		editText = '';
		onedit?.(message.id, text);
	}

	function handleEditKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			handleEditCancel();
		}
	}
</script>

<div class="message-row" class:user={message.role === 'user'} class:error={message.role === 'error'}>
	<div class="message-body">
		{#if message.role !== 'user'}
			<div class="message-role">{roleLabel}</div>
		{/if}

		{#if editing}
			<textarea
				class="edit-textarea"
				bind:value={editText}
				onkeydown={handleEditKeydown}
				rows={4}
			></textarea>
			<div class="edit-actions-inline">
				<button class="action-btn" onclick={handleEditCancel} title="取消">
					<span class="material-symbols-rounded">close</span>
				</button>
				<button class="action-btn action-btn-send" onclick={handleEditSubmit} title="发送">
					<span class="material-symbols-rounded">send</span>
				</button>
			</div>
		{:else}
			{#each message.blocks as block, i (i)}
				{#if block.type === 'text'}
					{#if isLiveBlock(block, i)}
						<div class="message-content">{block.content}</div>
					{:else}
						<div class="message-content markdown-body">{@html getBlockHtml(block.content)}</div>
					{/if}
				{:else if block.type === 'image'}
				<div class="image-block">
					<img src={block.url} alt="上传图片" />
				</div>
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

		{#if message.role === 'user' && message.done && !editing}
			<div class="msg-actions">
				<button class="action-btn" onclick={handleCopy} title="复制">
					<span class="material-symbols-rounded">content_copy</span>
				</button>
				<button class="action-btn" onclick={handleEditStart} title="编辑">
					<span class="material-symbols-rounded">edit</span>
				</button>
				<button class="action-btn" onclick={handleFork} title="分叉">
					<span class="material-symbols-rounded">call_split</span>
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
	{/if}
	</div>
</div>

<style>
	.message-row {
		display: flex;
		max-width: 100%;
		margin-bottom: 0.5rem;
		animation: msgEnter 0.35s var(--ease-out) both;
	}

	@keyframes msgEnter {
		from {
			opacity: 0;
			transform: translateY(12px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
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
		font-size: var(--text-sm);
		font-weight: 500;
		color: var(--text-secondary);
		padding: 0 0.5rem;
		margin-bottom: 0.1rem;
		letter-spacing: 0.02em;
	}

	.message-content {
		background: var(--bg-surface);
		border-radius: 6px 22px 22px 22px;
		padding: 1.25rem 1.5rem;
		font-size: var(--text-md);
		line-height: 1.75;
		letter-spacing: 0.015em;
		white-space: pre-wrap;
		word-break: break-word;
		box-shadow: var(--shadow-bubble);
		color: var(--text-primary);
	}

	.message-row.user .message-content {
		background: var(--accent);
		color: var(--text-on-accent);
		border-radius: 22px 6px 22px 22px;
		box-shadow: var(--shadow-bubble-user);
	}

	.message-row.error .message-content {
		background: var(--danger-bg);
		color: var(--danger-text);
		border-radius: 6px 18px 18px 18px;
	}

	.message-content.markdown-body {
		white-space: normal;
	}

	.markdown-body :global(h1),
	.markdown-body :global(h2),
	.markdown-body :global(h3),
	.markdown-body :global(h4),
	.markdown-body :global(h5),
	.markdown-body :global(h6) {
		margin: 1.5rem 0 0.75rem;
		line-height: var(--leading-snug);
		color: inherit;
		font-family: var(--font-serif);
		font-weight: 700;
	}
	.markdown-body :global(h1) { font-size: var(--text-2xl); }
	.markdown-body :global(h2) { font-size: 1.35rem; }
	.markdown-body :global(h3) { font-size: var(--text-lg); }

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
		margin-bottom: 0.35rem;
	}

	:global(.markdown-body code:not(pre code)) {
		font-family: var(--font-mono);
		font-size: 0.88em;
		background: var(--bg-tool);
		padding: 0.2em 0.5em;
		border-radius: var(--radius-sm);
		color: var(--accent);
		font-weight: 500;
	}

	:global(.message-row.user .markdown-body code:not(pre code)) {
		background: rgba(255, 255, 255, 0.15);
		color: var(--code-text-alt);
	}

	.markdown-body :global(pre) {
		margin: 0.75rem 0;
		padding: 1.25rem;
		border-radius: var(--radius-md);
		background: var(--bg-code);
		overflow-x: auto;
		position: relative;
	}

	.markdown-body :global(pre code.hljs) {
		font-family: var(--font-mono);
		font-size: 0.88rem;
		line-height: 1.6;
		background: none;
		padding: 0;
		color: var(--code-text);
	}

	.markdown-body :global(.code-lang) {
		position: absolute;
		top: 0.5rem;
		right: 0.75rem;
		font-size: 0.7rem;
		color: rgba(229, 218, 203, 0.4);
		font-family: var(--font-sans);
		pointer-events: none;
		letter-spacing: 0.03em;
		text-transform: uppercase;
	}

	.message-row.user .markdown-body :global(pre) {
		background: rgba(0, 0, 0, 0.2);
	}

	.markdown-body :global(blockquote) {
		margin: 1rem 0;
		padding: 0.75rem 1.5rem;
		border-left: 3px solid var(--accent);
		background: var(--bg-reasoning);
		border-radius: 4px var(--radius-md) var(--radius-md) 4px;
		color: var(--text-secondary);
		font-family: var(--font-serif);
		font-style: normal;
		font-size: var(--text-md);
		line-height: var(--leading-relaxed);
	}

	.markdown-body :global(blockquote:last-child) {
		margin-bottom: 0;
	}

	.message-row.user .markdown-body :global(blockquote) {
		border-left-color: rgba(255, 255, 255, 0.3);
		background: rgba(255, 255, 255, 0.08);
		color: var(--code-text-alt);
	}

	.markdown-body :global(table) {
		border-collapse: collapse;
		margin: 0.75rem 0;
		width: 100%;
		font-size: 0.92rem;
	}

	.markdown-body :global(th) {
		background: var(--bg-table);
		padding: 0.5rem 0.75rem;
		text-align: left;
		font-weight: 500;
		border-bottom: 2px solid var(--border-table);
	}

	.markdown-body :global(td) {
		padding: 0.5rem 0.75rem;
		border-bottom: 1px solid var(--bg-table);
	}

	.markdown-body :global(a) {
		color: var(--accent-link);
		text-decoration: underline;
		text-underline-offset: 3px;
		transition: color 0.2s var(--ease-out);
	}

	.markdown-body :global(a:hover) {
		color: var(--accent-hover);
	}

	.message-row.user .markdown-body :global(a) {
		color: var(--code-text-alt);
	}

	.markdown-body :global(hr) {
		border: none;
		border-top: 1px solid var(--border-table);
		margin: 1rem 0;
	}

	.markdown-body :global(strong) {
		font-weight: 600;
	}

	.markdown-body :global(img) {
		max-width: 100%;
		border-radius: var(--radius-md);
	}

	.error-recovery {
		background: var(--warn-bg);
		border: 1px solid var(--warn-border);
		border-radius: var(--radius-md);
		padding: 1rem 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.recovery-msg {
		margin: 0;
		font-size: 0.9rem;
		color: var(--text-mid);
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
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-pill);
		background: var(--bg-surface);
		color: var(--text-darker);
		cursor: pointer;
		font-size: var(--text-sm);
		font-weight: 500;
		font-family: inherit;
		transition: transform 0.15s var(--ease-out), background 0.2s var(--ease-out);
	}

	.btn-recovery:hover {
		background: var(--bg-table);
	}

	.btn-recovery:active {
		transform: scale(0.97);
	}

	.btn-recovery-secondary {
		background: var(--bg-secondary-btn);
	}

	.btn-recovery .material-symbols-rounded {
		font-size: 18px;
	}

	.msg-actions {
		display: flex;
		gap: 0.25rem;
		opacity: 0;
		transition: opacity 0.2s var(--ease-out);
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
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
		font-family: inherit;
		font-size: 0.8rem;
		transition: background 0.15s var(--ease-out), color 0.15s var(--ease-out);
	}

	.action-btn:hover {
		background: var(--bg-table);
		color: var(--text-darker);
	}

	.action-btn.confirm {
		background: var(--warn-card-bg);
		color: var(--warn-card-text);
	}

	.action-btn .material-symbols-rounded {
		font-size: 16px;
	}

	.confirm-label {
		white-space: nowrap;
	}

	.cursor {
		animation: cursorBlink 1s ease-in-out infinite;
		font-weight: 700;
		color: var(--accent);
	}

	.image-block {
		max-width: 320px;
	}

	.image-block img {
		width: 100%;
		height: auto;
		border-radius: var(--radius-lg);
		display: block;
	}

	.edit-textarea {
		width: 100%;
		padding: 1rem 1.25rem;
		border: 2px solid var(--accent);
		border-radius: 22px 6px 22px 22px;
		background: var(--bg-surface);
		color: var(--text-primary);
		font-family: inherit;
		font-size: var(--text-md);
		line-height: 1.7;
		resize: vertical;
		outline: none;
		box-shadow: var(--shadow-bubble-user);
		transition: border-color 0.2s var(--ease-out);
		box-sizing: border-box;
	}

	.edit-textarea:focus {
		border-color: var(--accent-link);
	}

	.edit-actions-inline {
		display: flex;
		gap: 0.25rem;
		justify-content: flex-end;
		margin-top: 0.25rem;
		opacity: 1;
	}

	.action-btn-send {
		color: var(--accent) !important;
	}

	@keyframes cursorBlink {
		0%, 40% { opacity: 1; }
		50%, 90% { opacity: 0; }
		100% { opacity: 1; }
	}
</style>
