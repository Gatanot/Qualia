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

	let hasInput = $derived(value.trim().length > 0);

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
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
			placeholder="输入消息..."
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
		margin: 0 1.5rem 1.5rem;
	}

	.queue-bar {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin-bottom: 0.5rem;
		padding: 0.35rem 0.75rem;
		background: #FFF8E1;
		border: 1px solid #FFE082;
		border-radius: 12px;
		font-size: 0.8rem;
		color: #6D645D;
	}

	.queue-icon {
		font-size: 16px;
		color: #D4A373;
	}

	.queue-text {
		font-weight: 500;
	}

	.input-bar {
		display: flex;
		gap: 0.5rem;
		padding: 0.5rem 0.5rem 0.5rem 1rem;
		background: #fff;
		border-radius: 32px;
		align-items: flex-end;
		box-shadow: 0 4px 20px rgba(74, 67, 62, 0.08);
		border: 1px solid #EAE4DC;
	}

	.chat-input {
		flex: 1;
		padding: 0.6rem 0;
		border: none;
		background: transparent;
		font-family: inherit;
		font-size: 0.95rem;
		resize: none;
		max-height: 120px;
		line-height: 1.5;
		outline: none;
		color: #4A433E;
	}

	.chat-input::placeholder {
		color: #A69E96;
	}

	.send-btn {
		width: 44px;
		height: 44px;
		border-radius: 50%;
		border: none;
		background: #6B7F72;
		color: #fff;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		transition: background 0.2s, transform 0.1s;
		margin-bottom: 2px;
	}

	.send-btn.stop-btn {
		background: #D32F2F;
	}

	.send-btn:hover:not(:disabled) {
		background: #5A6B60;
		transform: scale(1.05);
	}

	.send-btn.stop-btn:hover {
		background: #C62828;
		transform: scale(1.05);
	}

	.send-btn:disabled {
		background: #D6CFC7;
		cursor: default;
	}

	.send-btn .material-symbols-rounded {
		font-size: 22px;
	}
</style>
