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
		margin: 0 2rem 2rem;
	}

	.queue-bar {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
		padding: 0.5rem 1rem;
		background: #FFF9E6;
		border: 1px solid #FFE699;
		border-radius: 100px; /* pill shape */
		font-size: 0.85rem;
		color: #706862;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
		width: fit-content;
		margin-left: auto;
		margin-right: auto;
	}

	.queue-icon {
		font-size: 18px;
		color: #D4A373;
	}

	.queue-text {
		font-weight: 500;
	}

	.input-bar {
		display: flex;
		gap: 0.75rem;
		padding: 0.5rem 0.5rem 0.5rem 1.25rem;
		background: #FFFFFF;
		border-radius: 28px; /* M3 input radius */
		align-items: flex-end;
		box-shadow: 0 4px 16px rgba(61, 56, 52, 0.08), 0 1px 3px rgba(61, 56, 52, 0.04);
		border: 1px solid rgba(230, 226, 216, 0.4);
		transition: box-shadow 0.2s ease, border-color 0.2s ease;
	}

	.input-bar:focus-within {
		box-shadow: 0 6px 24px rgba(61, 56, 52, 0.12), 0 2px 6px rgba(61, 56, 52, 0.06);
		border-color: #D6E0D9;
	}

	.chat-input {
		flex: 1;
		padding: 0.75rem 0;
		border: none;
		background: transparent;
		font-family: inherit;
		font-size: 1rem;
		resize: none;
		max-height: 140px;
		line-height: 1.5;
		outline: none;
		color: #3D3834;
	}

	.chat-input::placeholder {
		color: #A39B93;
	}

	.send-btn {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		border: none;
		background: #5E7163; /* Updated primary */
		color: #FFFFFF;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		transition: background 0.2s, transform 0.15s cubic-bezier(0.2, 0, 0, 1);
		margin-bottom: 2px;
	}

	.send-btn.stop-btn {
		background: #D32F2F;
	}

	.send-btn:hover:not(:disabled) {
		background: #4A594E;
		transform: translateY(-1px);
		box-shadow: 0 4px 8px rgba(94, 113, 99, 0.2);
	}

	.send-btn.stop-btn:hover {
		background: #C62828;
		box-shadow: 0 4px 8px rgba(211, 47, 47, 0.2);
	}

	.send-btn:active:not(:disabled) {
		transform: translateY(0);
	}

	.send-btn:disabled {
		background: #E6E2D8;
		color: #A39B93;
		cursor: default;
	}

	.send-btn .material-symbols-rounded {
		font-size: 24px;
	}
</style>
