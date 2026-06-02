<script lang="ts">
	let { value = $bindable(''), streaming = false, queueCount = 0, onsend, onstop, focusTrigger = 0 }: {
		value: string;
		streaming: boolean;
		queueCount: number;
		onsend: () => void;
		onstop: () => void;
		focusTrigger?: number;
	} = $props();

	let textareaEl = $state<HTMLTextAreaElement>();

	$effect(() => {
		void focusTrigger;
		textareaEl?.focus();
	});

	$effect(() => {
		void value;
		autoResize();
	});

	let hasInput = $derived(value.trim().length > 0);
	const MAX_HEIGHT = 300;

	function autoResize() {
		const el = textareaEl;
		if (!el) return;
		el.style.height = 'auto';
		const h = Math.min(el.scrollHeight, MAX_HEIGHT);
		el.style.height = h + 'px';
		el.style.overflowY = el.scrollHeight > MAX_HEIGHT ? 'auto' : 'hidden';
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			autoResize();
			if (hasInput || streaming) {
				onsend();
			}
		}
	}

	function handleClick() {
		if (streaming) {
			onstop();
		} else {
			onsend();
		}
	}

	function handleInput() {
		autoResize();
	}
</script>

<div class="input-wrapper">
	{#if queueCount > 0}
		<div class="queue-bar">
			<span class="material-symbols-rounded queue-icon">hourglass</span>
			<span class="queue-text">排队中（{queueCount} 条）</span>
		</div>
	{/if}

	<div class="input-bar">
		<textarea
			class="chat-input"
			bind:value
			bind:this={textareaEl}
			onkeydown={handleKeydown}
			oninput={handleInput}
			placeholder="想说点什么... Shift+Enter 换行"
			rows={1}
		></textarea>
		<button
			class="send-btn"
			class:stop-btn={streaming}
			onclick={handleClick}
			disabled={!streaming && !hasInput}
		>
			<span class="material-symbols-rounded">
				{streaming ? 'stop' : 'send'}
			</span>
		</button>
	</div>
</div>

<style>
	.input-wrapper {
		margin: 0 2rem 2rem;
	}

	.queue-bar {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
		padding: 0.5rem 1.25rem;
		background: var(--bg-surface);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-pill);
		font-size: var(--text-sm);
		color: var(--text-secondary);
		box-shadow: var(--shadow-xs);
		width: fit-content;
		margin-left: auto;
		margin-right: auto;
		animation: fadeSlideUp 0.3s var(--ease-out);
	}

	@keyframes fadeSlideUp {
		from { opacity: 0; transform: translateY(8px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.queue-icon {
		font-size: 18px;
		color: var(--accent);
	}

	.queue-text {
		font-weight: 500;
	}

	.input-bar {
		display: flex;
		gap: 0.75rem;
		padding: 0.5rem 0.5rem 0.5rem 1.5rem;
		background: var(--bg-surface);
		border-radius: 32px;
		align-items: flex-end;
		box-shadow: var(--shadow-elevate);
		border: 1px solid var(--border-subtle);
		transition: box-shadow 0.3s var(--ease-out), border-color 0.3s var(--ease-out), transform 0.3s var(--ease-out);
	}

	.input-bar:focus-within {
		box-shadow: var(--shadow-elevate-focus);
		border-color: var(--border-focus);
		transform: translateY(-2px);
	}

	.chat-input {
		flex: 1;
		padding: 0.85rem 0;
		border: none;
		background: transparent;
		font-family: inherit;
		font-size: var(--text-md);
		resize: none;
		line-height: var(--leading-normal);
		outline: none;
		color: var(--text-primary);
	}

	.chat-input::placeholder {
		color: var(--text-placeholder);
		font-style: italic;
		opacity: 0.7;
	}

	.send-btn {
		width: 52px;
		height: 52px;
		border-radius: var(--radius-full);
		border: none;
		background: var(--accent);
		color: var(--text-on-accent);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		transition: background 0.25s var(--ease-out), transform 0.25s var(--ease-spring), box-shadow 0.25s var(--ease-out);
		margin-bottom: 2px;
		box-shadow: var(--shadow-accent-btn);
	}

	.send-btn.stop-btn {
		background: var(--stop-bg);
		box-shadow: var(--shadow-accent-btn);
	}

	.send-btn:hover:not(:disabled) {
		background: var(--accent-hover);
		transform: translateY(-2px) scale(1.05);
		box-shadow: var(--shadow-accent-btn-hover);
	}

	.send-btn.stop-btn:hover {
		background: var(--stop-hover);
		box-shadow: var(--shadow-stop-hover);
	}

	.send-btn:active:not(:disabled) {
		transform: translateY(0) scale(0.96);
		box-shadow: var(--shadow-accent-btn-active);
	}

	.send-btn:disabled {
		background: var(--bg-disabled);
		color: var(--text-disabled);
		cursor: default;
		box-shadow: none;
	}

	.send-btn .material-symbols-rounded {
		font-size: 24px;
		transition: transform 0.25s var(--ease-spring);
	}

	.send-btn:hover:not(:disabled) .material-symbols-rounded {
		transform: rotate(-15deg);
	}

	.send-btn.stop-btn:hover .material-symbols-rounded {
		transform: rotate(0deg);
	}
</style>
