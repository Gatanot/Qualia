<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import SessionSidebar from '$lib/components/SessionSidebar.svelte';
	import { initTheme } from '$lib/theme';
	import type { AppConfig } from '$lib/config';
	import 'katex/dist/katex.min.css';

	let { children } = $props();

	let sidebarOpen = $state(false);
	let customIcon = $state(false);
	let config = $state<AppConfig>({ providers: [], activeModel: '', storageEnabled: false, systemPrompt: '', customBrandIcon: false, autoSummarize: true, summaryMode: 'idle', summaryIdleHours: 8, summaryScheduleHour: 2, summaryIntervalMin: 30 });
	let allModels = $state<{ id: string; name: string; providerName: string }[]>([]);

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
		config = c;
		customIcon = c.customBrandIcon === true;
		const modelsRes = await fetch('/api/models');
		if (modelsRes.ok) {
			allModels = await modelsRes.json();
		}
	}

	async function selectModel(modelId: string) {
		const res = await fetch('/api/config', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'setActiveModel', modelId })
		});
		if (res.ok) {
			config = await res.json();
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

<div class="app">
	<SessionSidebar bind:mobileOpen={sidebarOpen} customIcon={customIcon} />

	<div class="main-wrapper">
		<header class="app-header">
			<button class="icon-btn" onclick={toggleSidebar}>
				<span class="material-symbols-rounded">menu</span>
			</button>
			<a href="/" class="app-title">Qualia</a>
			<div class="header-right">
				{#if allModels.length > 0}
					<select
						class="model-select"
						value={config.activeModel}
						onchange={(e: Event) => selectModel((e.target as HTMLSelectElement).value)}
					>
						{#each allModels as m (m.id)}
							<option value={m.id}>{m.name}</option>
						{/each}
					</select>
				{/if}
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
		--bg-page: #FCFAF5;
		--bg-sidebar: #F4F1E9;
		--bg-surface: #FFFDF9;
		--bg-surface-hover: #F5F2EA;
		--bg-surface-active: #EEE9DF;
		--bg-surface-press: #E8E3D7;
		--bg-surface-alt: #F9F7F2;
		--bg-input: #F9F7F2;
		--bg-code: #2D2A26;
		--bg-tool: #F3F0E7;
		--bg-reasoning: #F8F5EC;
		--bg-done: #F0ECE2;
		--bg-disabled: #EDEAE0;
		--bg-secondary-btn: #FAF8F3;
		--bg-table: #F2EEE3;
		--bg-card: #FFFDF9;

		--text-primary: #3D3935;
		--text-secondary: #7A726A;
		--text-mid: #675F58;
		--text-muted: #A19A90;
		--text-placeholder: #C3BCB0;
		--text-disabled: #B5AFA5;
		--text-darker: #312D29;
		--text-on-accent: #FFFFFF;

		--accent: #827561;
		--accent-hover: #6D604F;
		--accent-link: #7A6D5B;
		--accent-subtle: rgba(130, 117, 97, 0.08);
		--accent-glow: rgba(130, 117, 97, 0.12);

		--border: rgba(210, 202, 187, 0.5);
		--border-subtle: rgba(225, 217, 202, 0.45);
		--border-strong: rgba(218, 209, 193, 0.75);
		--border-input: #E3DDCE;
		--border-hover: #D6CFBF;
		--border-focus: #CEC6B4;
		--border-table: #E3DDCE;
		--border-accent: rgba(210, 202, 187, 0.65);

		--scrollbar: #D2CBB9;
		--scrollbar-layout: #E9E2D3;

		--danger-bg: #FCEAE7;
		--danger-text: #B91C1C;
		--danger-btn: #D32F2F;
		--danger-btn-hover-bg: #FDE8E5;

		--stop-bg: #D07C78;
		--stop-hover: #B7625E;

		--warn-bg: #FFFBE8;
		--warn-border: #FEE898;
		--warn-text: #6D5E00;
		--warn-card-bg: #FFF4E0;
		--warn-card-text: #E75200;
		--warm-accent: #D5A474;

		--bg-info: #FFF9E0;
		--info-text: #6D5E00;

		--code-text: #E5DACB;
		--code-text-alt: #E7E2D7;

		--overlay: rgba(50, 45, 40, 0.35);
		--overlay-heavy: rgba(50, 45, 40, 0.5);

		--shadow-xs: 0 1px 4px rgba(60, 55, 48, 0.02);
		--shadow-sm: 0 2px 12px rgba(60, 55, 48, 0.04);
		--shadow-md: 0 4px 20px rgba(60, 55, 48, 0.06);
		--shadow-lg: 0 12px 40px rgba(60, 55, 48, 0.08);
		--shadow-xl: 0 20px 60px rgba(50, 45, 38, 0.1);
		--shadow-focus: 0 0 0 3px rgba(130, 117, 97, 0.18);
		--shadow-elevate: 0 1px 4px rgba(60, 55, 48, 0.04), 0 4px 20px rgba(60, 55, 48, 0.05), 0 12px 40px rgba(60, 55, 48, 0.04);
		--shadow-elevate-focus: 0 1px 4px rgba(60, 55, 48, 0.06), 0 8px 28px rgba(60, 55, 48, 0.08), 0 16px 56px rgba(60, 55, 48, 0.06);
		--shadow-accent-btn: 0 2px 12px rgba(130, 117, 97, 0.18), 0 1px 3px rgba(130, 117, 97, 0.08);
		--shadow-accent-btn-hover: 0 4px 20px rgba(109, 96, 79, 0.28), 0 1px 4px rgba(109, 96, 79, 0.12);
		--shadow-accent-btn-active: 0 1px 6px rgba(109, 96, 79, 0.2);
		--shadow-bubble: 0 1px 3px rgba(60, 55, 48, 0.03), 0 3px 16px rgba(60, 55, 48, 0.04);
		--shadow-bubble-user: 0 2px 12px rgba(130, 117, 97, 0.16), 0 1px 3px rgba(130, 117, 97, 0.08);
		--shadow-stop-hover: 0 4px 20px rgba(208, 124, 120, 0.3);
		--shadow-modal: 0 4px 20px rgba(50, 45, 38, 0.08), 0 16px 60px rgba(50, 45, 38, 0.12);
		--shadow-sidebar: 2px 0 20px rgba(60, 55, 48, 0.08);
		--shadow-knob: 0 2px 8px rgba(80, 72, 62, 0.14);

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
		--bg-page: #1C1917;
		--bg-sidebar: #221E1B;
		--bg-surface: #292421;
		--bg-surface-hover: #322C28;
		--bg-surface-active: #3A332F;
		--bg-surface-press: #3F3833;
		--bg-surface-alt: #26221E;
		--bg-input: #231F1C;
		--bg-code: #211E1A;
		--bg-tool: #26221E;
		--bg-reasoning: #24201D;
		--bg-done: #322C28;
		--bg-disabled: #2B2723;
		--bg-secondary-btn: #2B2723;
		--bg-table: #2B2723;
		--bg-card: #292421;

		--text-primary: #E9E3DA;
		--text-secondary: #A9A096;
		--text-mid: #8D847A;
		--text-muted: #716961;
		--text-placeholder: #5B544D;
		--text-disabled: #4E4842;
		--text-darker: #F1ECE4;
		--text-on-accent: #FFFFFF;

		--accent: #9C8C78;
		--accent-hover: #8C7D69;
		--accent-link: #968673;
		--accent-subtle: rgba(156, 140, 120, 0.1);
		--accent-glow: rgba(156, 140, 120, 0.15);

		--border: rgba(95, 87, 80, 0.4);
		--border-subtle: rgba(95, 87, 80, 0.28);
		--border-strong: rgba(85, 77, 70, 0.5);
		--border-input: #3B3530;
		--border-hover: #4A433D;
		--border-focus: #726960;
		--border-table: #3B3530;
		--border-accent: rgba(156, 140, 120, 0.2);

		--scrollbar: #3E3833;
		--scrollbar-layout: #37312C;

		--danger-bg: #341F21;
		--danger-text: #E98481;
		--danger-btn: #F18986;
		--danger-btn-hover-bg: #442729;

		--stop-bg: #B86461;
		--stop-hover: #CE7B78;

		--warn-bg: #2D2A1E;
		--warn-border: #5D5218;
		--warn-text: #CFB641;
		--warn-card-bg: #2E2A1B;
		--warn-card-text: #FF9969;
		--warm-accent: #D5A474;

		--bg-info: #2D2A1E;
		--info-text: #CFB641;

		--code-text: #D5CBBE;
		--code-text-alt: #E7E2D7;

		--overlay: rgba(0, 0, 0, 0.55);
		--overlay-heavy: rgba(0, 0, 0, 0.65);

		--shadow-xs: none;
		--shadow-sm: none;
		--shadow-md: 0 4px 20px rgba(0, 0, 0, 0.18);
		--shadow-lg: 0 12px 48px rgba(0, 0, 0, 0.3);
		--shadow-xl: 0 20px 60px rgba(0, 0, 0, 0.4);
		--shadow-focus: 0 0 0 3px rgba(156, 140, 120, 0.35);
		--shadow-elevate: 0 0 0 1px rgba(156, 140, 120, 0.1), 0 4px 24px rgba(0, 0, 0, 0.2), 0 12px 48px rgba(0, 0, 0, 0.15);
		--shadow-elevate-focus: 0 0 0 1px rgba(156, 140, 120, 0.2), 0 8px 32px rgba(0, 0, 0, 0.3), 0 16px 56px rgba(0, 0, 0, 0.2);
		--shadow-accent-btn: 0 2px 16px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(156, 140, 120, 0.15);
		--shadow-accent-btn-hover: 0 4px 24px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(156, 140, 120, 0.25);
		--shadow-accent-btn-active: 0 1px 6px rgba(0, 0, 0, 0.25);
		--shadow-bubble: 0 0 0 1px rgba(95, 87, 80, 0.18), 0 4px 24px rgba(0, 0, 0, 0.18);
		--shadow-bubble-user: 0 0 0 1px rgba(156, 140, 120, 0.2), 0 4px 24px rgba(0, 0, 0, 0.3);
		--shadow-stop-hover: 0 4px 20px rgba(184, 100, 97, 0.35);
		--shadow-modal: 0 4px 20px rgba(0, 0, 0, 0.3), 0 16px 64px rgba(0, 0, 0, 0.5);
		--shadow-sidebar: 2px 0 24px rgba(0, 0, 0, 0.4);
		--shadow-knob: 0 2px 8px rgba(0, 0, 0, 0.35);
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

	.model-select {
		font-family: inherit;
		font-size: var(--text-sm);
		color: var(--text-primary);
		background: var(--bg-surface);
		border: 1px solid var(--border-accent);
		border-radius: var(--radius-pill);
		padding: 0.4rem 2rem 0.4rem 1rem;
		cursor: pointer;
		appearance: none;
		-webkit-appearance: none;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%237A726A' d='M2 4l4 4 4-4'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 0.6rem center;
		transition: border-color 0.2s var(--ease-out), box-shadow 0.2s var(--ease-out);
		white-space: nowrap;
	}

	.model-select:hover {
		border-color: var(--border-hover);
	}

	.model-select:focus {
		outline: none;
		border-color: var(--accent);
		box-shadow: var(--shadow-focus);
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
