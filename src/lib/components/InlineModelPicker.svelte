<script lang="ts">
	import { pickerState, reasoningOptions } from '$lib/model-picker-state.svelte';

	let showPopup = $state(false);

	function togglePopup() {
		showPopup = !showPopup;
	}

	function closePopup() {
		showPopup = false;
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
		showPopup = false;
	}
</script>

<div class="model-picker">
	<button class="plus-btn" onclick={togglePopup} aria-label="切换模型">
		<span class="material-symbols-rounded">add</span>
	</button>

	{#if showPopup}
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div class="popup-backdrop" onclick={closePopup} onkeydown={(e: KeyboardEvent) => e.key === 'Escape' && closePopup()} role="dialog" tabindex="-1">
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<div class="popup" onclick={(e: Event) => e.stopPropagation()} onkeydown={(e: Event) => e.stopPropagation()} role="document" tabindex="-1">
				<div class="popup-title">选择模型</div>
				{#each pickerState.allModels as m (m.id)}
					<button
						class="model-option"
						class:active={pickerState.config?.activeModel === m.id}
						onclick={() => selectModel(m.id)}
					>
						<span class="model-name">{m.name}</span>
						<span class="model-provider">{m.providerName}</span>
					</button>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.model-picker {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		flex-shrink: 0;
		position: relative;
	}

	.plus-btn {
		width: 36px;
		height: 36px;
		border-radius: var(--radius-full);
		border: 1px solid var(--border-accent);
		background: var(--bg-surface);
		color: var(--text-secondary);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s var(--ease-out);
		flex-shrink: 0;
	}

	.plus-btn:hover {
		background: var(--bg-surface-hover);
		color: var(--text-primary);
		border-color: var(--border-hover);
	}

	.plus-btn .material-symbols-rounded {
		font-size: 20px;
	}

	.popup-backdrop {
		position: fixed;
		inset: 0;
		z-index: 200;
	}

	.popup {
		position: absolute;
		bottom: calc(100% + 8px);
		left: 0;
		background: var(--bg-surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-xl);
		padding: 0.75rem;
		min-width: 240px;
		box-shadow: var(--shadow-elevate);
		animation: popupIn 0.2s var(--ease-out) forwards;
	}

	@keyframes popupIn {
		from { opacity: 0; transform: translateY(8px) scale(0.96); }
		to { opacity: 1; transform: translateY(0) scale(1); }
	}

	.popup-title {
		font-size: var(--text-sm);
		color: var(--text-muted);
		padding: 0.5rem 0.75rem 0.75rem;
		font-weight: 500;
	}

	.model-option {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		padding: 0.6rem 0.75rem;
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

	.model-name {
		font-weight: 500;
	}

	.model-provider {
		font-size: var(--text-xs);
		color: var(--text-muted);
	}
</style>
