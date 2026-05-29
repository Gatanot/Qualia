<script lang="ts">
	let { value = $bindable(''), disabled = false, onsend }: { value: string; disabled: boolean; onsend: () => void } = $props();

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			onsend();
		}
	}
</script>

<div class="input-bar">
	<textarea
		class="chat-input"
		bind:value
		onkeydown={handleKeydown}
		placeholder="输入消息..."
		rows={1}
		disabled={disabled}
	></textarea>
	<button
		class="send-btn"
		onclick={() => onsend()}
		disabled={disabled || !value.trim()}
	>
		<span class="material-symbols-rounded">send</span>
	</button>
</div>

<style>
	.input-bar {
		display: flex;
		gap: 0.5rem;
		margin: 0 1.5rem 1.5rem;
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

	.send-btn:hover:not(:disabled) {
		background: #5A6B60;
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
