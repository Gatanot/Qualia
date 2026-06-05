<script lang="ts">
	import InlineModelPicker from './InlineModelPicker.svelte';
	import { pickerState, activeModelDef, reasoningEffort, reasoningOptions } from '$lib/model-picker-state.svelte';

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

	let showModelPopup = $state(false);

	function toggleModelPopup() {
		showModelPopup = !showModelPopup;
	}

	function closeModelPopup() {
		showModelPopup = false;
	}

	async function selectModel(modelId: string) {
		const res = await fetch('/api/config', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'setActiveModel', modelId })
		});
		if (res.ok) {
			pickerState.config = await res.json();
		}
		showModelPopup = false;
	}

	async function selectReasoning(value: string) {
		const res = await fetch('/api/config', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'setReasoningEffort', value: value || null })
		});
		if (res.ok) {
			pickerState.config = await res.json();
		}
	}

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
		<InlineModelPicker />
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

	<div class="input-footer">
		{#if pickerState.config?.activeModel}
			<button class="model-name-btn" onclick={toggleModelPopup}>
				{activeModelDef()?.name || pickerState.config.activeModel}
			</button>
		{/if}
		{#if reasoningOptions().length > 0}
			<select
				class="reasoning-select"
				value={reasoningEffort() || ''}
				onchange={(e: Event) => selectReasoning((e.target as HTMLSelectElement).value)}
			>
				<option value="">不思考</option>
				{#each reasoningOptions() as v}
					<option value={v}>{v === 'enabled' ? '开启' : v}</option>
				{/each}
			</select>
		{/if}
	</div>

	{#if showModelPopup}
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div class="modal-overlay" onclick={closeModelPopup} onkeydown={(e: KeyboardEvent) => e.key === 'Escape' && closeModelPopup()} role="dialog" tabindex="-1">
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<div class="modal" onclick={(e: Event) => e.stopPropagation()} onkeydown={(e: Event) => e.stopPropagation()} role="document" tabindex="-1">
				<h3>选择模型</h3>
				<div class="model-list">
					{#each pickerState.allModels as m (m.id)}
						<button
							class="model-option"
							class:active={pickerState.config?.activeModel === m.id}
							onclick={() => selectModel(m.id)}
						>
							<span class="model-opt-name">{m.name}</span>
							<span class="model-opt-provider">{m.providerName}</span>
						</button>
					{/each}
				</div>
			</div>
		</div>
	{/if}
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

	.input-footer {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.5rem 0 1.5rem;
	}

	.model-name-btn {
		font-family: inherit;
		font-size: 0.78rem;
		color: var(--text-secondary);
		background: transparent;
		border: 1px solid var(--border-accent);
		border-radius: var(--radius-pill);
		padding: 0.2rem 0.75rem;
		cursor: pointer;
		transition: all 0.2s var(--ease-out);
		white-space: nowrap;
		font-weight: 400;
	}

	.model-name-btn:hover {
		background: var(--bg-surface-hover);
		border-color: var(--border-hover);
		color: var(--text-primary);
	}

	.reasoning-select {
		font-family: inherit;
		font-size: 0.78rem;
		color: var(--text-secondary);
		background: transparent;
		border: 1px solid var(--border-accent);
		border-radius: var(--radius-pill);
		padding: 0.2rem 1.75rem 0.2rem 0.6rem;
		cursor: pointer;
		appearance: none;
		-webkit-appearance: none;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'%3E%3Cpath fill='%237A726A' d='M2 3l3 3 3-3'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 0.4rem center;
		transition: border-color 0.2s var(--ease-out);
		white-space: nowrap;
		max-width: 80px;
	}

	.reasoning-select:hover {
		border-color: var(--border-hover);
	}

	.reasoning-select:focus {
		outline: none;
		border-color: var(--accent);
	}

	.modal-overlay {
		position: fixed;
		inset: 0;
		background: var(--overlay-heavy);
		backdrop-filter: blur(4px);
		-webkit-backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 200;
	}

	.modal {
		background: var(--bg-surface);
		border-radius: var(--radius-3xl);
		padding: 2rem;
		width: 100%;
		max-width: 360px;
		max-height: 70vh;
		overflow-y: auto;
		box-shadow: var(--shadow-modal);
		animation: modalIn 0.25s var(--ease-out) forwards;
	}

	@keyframes modalIn {
		from { opacity: 0; transform: scale(0.94) translateY(12px); }
		to { opacity: 1; transform: scale(1) translateY(0); }
	}

	.modal h3 {
		margin: 0 0 1.25rem;
		font-size: var(--text-xl);
		font-weight: 500;
		color: var(--text-primary);
	}

	.model-list {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.model-option {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		padding: 0.75rem 1rem;
		border: none;
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--text-primary);
		font-family: inherit;
		font-size: var(--text-base);
		cursor: pointer;
		transition: background 0.15s var(--ease-out);
	}

	.model-option:hover {
		background: var(--bg-surface-hover);
	}

	.model-option.active {
		background: var(--accent-subtle);
	}

	.model-opt-name {
		font-weight: 500;
	}

	.model-opt-provider {
		font-size: var(--text-sm);
		color: var(--text-muted);
	}
</style>
