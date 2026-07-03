<script lang="ts">
	let { onpickimage = () => {} }: {
		onpickimage?: () => void;
	} = $props();

	let showMenu = $state(false);

	function toggleMenu() {
		showMenu = !showMenu;
	}

	function closeMenu() {
		showMenu = false;
	}

	function handlePickImage() {
		showMenu = false;
		onpickimage();
	}
</script>

<div class="plus-wrapper">
	<button class="plus-btn" aria-label="添加" onclick={toggleMenu}>
		<span class="material-symbols-rounded">add</span>
	</button>

	{#if showMenu}
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div class="menu-overlay" onclick={closeMenu} onkeydown={(e: KeyboardEvent) => e.key === 'Escape' && closeMenu()} role="dialog" tabindex="-1">
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<div class="menu-dropdown" onclick={(e: Event) => e.stopPropagation()} onkeydown={(e: Event) => e.stopPropagation()} role="menu" tabindex="-1">
				<button class="menu-item" onclick={handlePickImage}>
					<span class="material-symbols-rounded menu-icon">image</span>
					<span>上传图片</span>
				</button>
				<button class="menu-item disabled" disabled>
					<span class="material-symbols-rounded menu-icon">upload_file</span>
					<span>上传文件</span>
				</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.plus-wrapper {
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

	.menu-overlay {
		position: fixed;
		inset: 0;
		z-index: 201;
	}

	.menu-dropdown {
		position: absolute;
		bottom: calc(100% + 8px);
		left: 0;
		background: var(--bg-surface);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-elevate);
		padding: 0.25rem;
		min-width: 140px;
		animation: menuIn 0.2s var(--ease-out) forwards;
	}

	@keyframes menuIn {
		from { opacity: 0; transform: translateY(6px) scale(0.96); }
		to { opacity: 1; transform: translateY(0) scale(1); }
	}

	.menu-item {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		width: 100%;
		padding: 0.65rem 0.85rem;
		border: none;
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--text-primary);
		font-family: inherit;
		font-size: var(--text-sm);
		cursor: pointer;
		transition: background 0.15s var(--ease-out);
		white-space: nowrap;
	}

	.menu-item:hover:not(.disabled) {
		background: var(--bg-surface-hover);
	}

	.menu-item.disabled {
		color: var(--text-disabled);
		cursor: default;
	}

	.menu-icon {
		font-size: 18px;
		flex-shrink: 0;
	}
</style>
