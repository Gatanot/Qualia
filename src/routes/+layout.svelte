<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import SessionSidebar from '$lib/components/SessionSidebar.svelte';
	import { initTheme } from '$lib/theme';
	import { pickerState } from '$lib/model-picker-state.svelte';
	import 'katex/dist/katex.min.css';

	let { children, data } = $props();

	let sidebarOpen = $state(false);
	let customIcon = $state(false);

	const lightVars = Object.entries(data.tokens.light as Record<string, string>)
		.map(([k, v]) => `${k}: ${v};`)
		.join('\n\t\t');
	const darkVars = Object.entries(data.tokens.dark as Record<string, string>)
		.map(([k, v]) => `${k}: ${v};`)
		.join('\n\t\t');

	function toggleSidebar() {
		sidebarOpen = !sidebarOpen;
	}

	function closeSidebar() {
		sidebarOpen = false;
	}

	async function loadConfig() {
		const res = await fetch('/api/config');
		if (!res.ok) return;
		const c = await res.json();
		pickerState.config = c;
		customIcon = c.customBrandIcon === true;
		const modelsRes = await fetch('/api/models');
		if (modelsRes.ok) {
			pickerState.allModels = await modelsRes.json();
		}
	}

	$effect(() => {
		initTheme();
		loadConfig();
	});
</script>

<svelte:head>
	<title>Qualia</title>
	<link rel="icon" href={favicon} />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
	<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700&family=Noto+Serif+SC:wght@400;700&family=Roboto:wght@300;400;500;700&display=swap" rel="stylesheet" />
	<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,0,0" rel="stylesheet" />
	{#if sidebarOpen}
		<style>
			html, body { overflow: hidden; }
		</style>
	{/if}
</svelte:head>

{@html `<!-- theme: ${data.name} -->`}

<div class="app">
	<SessionSidebar bind:mobileOpen={sidebarOpen} customIcon={customIcon} />

	<div class="main-wrapper">
		<header class="app-header">
			<button class="icon-btn" onclick={toggleSidebar}>
				<span class="material-symbols-rounded">menu</span>
			</button>
			<a href="/" class="app-title">Qualia</a>
			<div class="header-right">
				<a href="/" class="icon-btn new-chat-btn">
					<span class="material-symbols-rounded">add_comment</span>
				</a>
			</div>
		</header>
		<main>
			{#if sidebarOpen}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div class="scrim" onclick={closeSidebar}></div>
			{/if}
			{@render children()}
		</main>
	</div>
</div>

<style>
	:global(:root) {
		{lightVars}

		--radius-xs: 4px;
		--radius-sm: 8px;
		--radius-md: 12px;
		--radius-lg: 16px;
		--radius-xl: 20px;
		--radius-2xl: 24px;
		--radius-3xl: 28px;
		--radius-pill: 100px;
		--radius-full: 50%;

		--space-xs: 0.25rem;
		--space-sm: 0.5rem;
		--space-md: 0.75rem;
		--space-lg: 1rem;
		--space-xl: 1.5rem;
		--space-2xl: 2rem;
		--space-3xl: 2.5rem;
		--space-4xl: 3rem;

		--text-xs: 0.72rem;
		--text-sm: 0.85rem;
		--text-base: 0.95rem;
		--text-md: 1.05rem;
		--text-lg: 1.15rem;
		--text-xl: 1.25rem;
		--text-2xl: 1.5rem;
		--text-3xl: 2rem;
		--text-4xl: 2.25rem;

		--font-sans: 'Noto Sans SC', 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		--font-serif: 'Noto Serif SC', 'Noto Sans SC', serif;
		--font-mono: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace;

		--ease-out: cubic-bezier(0.2, 0, 0, 1);
		--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
		--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);

		--leading-relaxed: 1.75;
		--leading-normal: 1.6;
		--leading-snug: 1.4;
	}

	:global([data-theme="dark"]) {
		{darkVars}
	}

	:global(body),
	:global(main),
	:global(.app-header),
	:global(.message-content),
	:global(.scrim),
	:global(.icon-btn),
	:global(.input-bar),
	:global(.chat-input),
	:global(.session-sidebar) {
		transition: background-color 0.5s ease, color 0.5s ease, border-color 0.5s ease, box-shadow 0.5s ease;
	}

	:global(body) {
		margin: 0;
		font-family: var(--font-sans);
		background: var(--bg-page);
		color: var(--text-primary);
		-webkit-font-smoothing: antialiased;
		-moz-osx-font-smoothing: grayscale;
		line-height: var(--leading-normal);
		font-size: var(--text-base);
	}

	:global(::selection) {
		background: var(--accent-subtle);
		color: var(--text-darker);
	}

	:global(input::placeholder),
	:global(textarea::placeholder) {
		color: var(--text-placeholder);
		font-style: italic;
		opacity: 0.7;
	}

	:global(:focus-visible) {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
		border-radius: 2px;
	}

	:global(.math-block) {
		margin: 0.75rem 0;
		overflow-x: auto;
	}

	:global([data-theme="dark"] .katex) {
		color: var(--text-primary);
	}

	.app {
		display: flex;
		height: 100dvh;
		overflow: hidden;
	}

	.main-wrapper {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
		position: relative;
	}

	.app-header {
		display: flex;
		height: 56px;
		align-items: center;
		justify-content: space-between;
		padding: 0 var(--space-sm);
		background: var(--bg-page);
		border-bottom: 1px solid var(--border-subtle);
		flex-shrink: 0;
		z-index: 10;
	}

	.app-title {
		font-weight: 700;
		font-family: var(--font-serif);
		font-size: var(--text-xl);
		color: var(--text-primary);
		text-decoration: none;
		letter-spacing: 0.03em;
		transition: color 0.3s var(--ease-out);
	}

	.app-title:hover {
		color: var(--accent);
	}

	.icon-btn {
		width: 40px;
		height: 40px;
		border: none;
		border-radius: var(--radius-full);
		background: transparent;
		color: var(--text-mid);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		text-decoration: none;
		transition: background 0.2s var(--ease-out), color 0.2s var(--ease-out), transform 0.15s var(--ease-out);
	}

	.icon-btn:hover {
		color: var(--text-primary);
	}

	.icon-btn:active {
		background: var(--bg-surface-press);
		transform: scale(0.95);
	}

	.header-right {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	main {
		flex: 1;
		overflow-y: auto;
		overscroll-behavior: contain;
		background: var(--bg-page);
		position: relative;
	}

	.scrim {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: var(--overlay);
		z-index: 40;
		animation: fadeIn 0.25s var(--ease-out);
		backdrop-filter: blur(3px);
		-webkit-backdrop-filter: blur(3px);
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}
</style>
