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
			placeholder="输入消息... Shift+Enter 换行"
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
		border-radius: 100px;
		font-size: 0.85rem;
		color: var(--text-secondary);
		box-shadow: var(--shadow-sm);
		width: fit-content;
		margin-left: auto;
		margin-right: auto;
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
		box-shadow: 0 8px 32px rgba(74, 69, 66, 0.08), 0 2px 8px rgba(74, 69, 66, 0.04);
		border: 1px solid rgba(230, 226, 216, 0.3);
		transition: box-shadow 0.25s ease, border-color 0.25s ease, transform 0.25s ease;
	}

	.input-bar:focus-within {
		box-shadow: 0 12px 48px rgba(74, 69, 66, 0.12), 0 4px 16px rgba(74, 69, 66, 0.06);
		border-color: var(--border-focus);
		transform: translateY(-1px);
	}

	.chat-input {
		flex: 1;
		padding: 0.85rem 0;
		border: none;
		background: transparent;
		font-family: inherit;
		font-size: 1.05rem;
		resize: none;
		line-height: 1.6;
		outline: none;
		color: var(--text-primary);
	}

	.chat-input::placeholder {
		color: var(--text-muted);
	}

	.send-btn {
		width: 52px;
		height: 52px;
		border-radius: 50%;
		border: none;
		background: var(--accent);
		color: var(--text-on-accent);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		transition: background 0.25s ease, transform 0.2s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.25s ease;
		margin-bottom: 2px;
	}

	.send-btn.stop-btn {
		background: var(--stop-bg);
	}

	.send-btn:hover:not(:disabled) {
		background: var(--accent-hover);
		transform: translateY(-2px);
		box-shadow: 0 6px 16px rgba(123, 140, 124, 0.25);
	}

	.send-btn.stop-btn:hover {
		background: var(--stop-hover);
		box-shadow: 0 6px 16px rgba(211, 125, 122, 0.25);
	}

	.send-btn:active:not(:disabled) {
		transform: translateY(0);
		box-shadow: 0 2px 8px rgba(123, 140, 124, 0.2);
	}

	.send-btn:disabled {
		background: var(--bg-disabled);
		color: var(--text-disabled);
		cursor: default;
		box-shadow: none;
	}

	.send-btn .material-symbols-rounded {
		font-size: 24px;
	}
</style>
