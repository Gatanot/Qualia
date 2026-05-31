<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import SessionSidebar from '$lib/components/SessionSidebar.svelte';
	import { initTheme } from '$lib/theme';

	let { children } = $props();

	let sidebarOpen = $state(false);

	function toggleSidebar() {
		sidebarOpen = !sidebarOpen;
	}

	function closeSidebar() {
		sidebarOpen = false;
	}

	$effect(() => {
		initTheme();
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
	<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700&family=Roboto:wght@300;400;500;700&display=swap" rel="stylesheet" />
	<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,0,0" rel="stylesheet" />
</svelte:head>

<div class="app">
	<SessionSidebar bind:mobileOpen={sidebarOpen} />

	<div class="main-wrapper">
		<header class="app-header">
			<button class="icon-btn" onclick={toggleSidebar}>
				<span class="material-symbols-rounded">menu</span>
			</button>
			<a href="/" class="app-title">Qualia</a>
			<a href="/" class="icon-btn new-chat-btn">
				<span class="material-symbols-rounded">add_comment</span>
			</a>
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
		--bg-page: #FBF9F6;
		--bg-sidebar: #F3F0E9;
		--bg-surface: #FFFFFF;
		--bg-surface-hover: #F2EEE5;
		--bg-surface-active: #EAE6DD;
		--bg-surface-press: #E8E4DB;
		--bg-surface-alt: #F8FAF8;
		--bg-input: #F8FAF8;
		--bg-code: #2D2A27;
		--bg-tool: #F4F1EA;
		--bg-reasoning: #F8F6F0;
		--bg-done: #F2EEE5;
		--bg-disabled: #EDEBE4;
		--bg-secondary-btn: #FAF8F5;
		--bg-table: #F0EBE1;

		--text-primary: #4A4542;
		--text-secondary: #8E857D;
		--text-mid: #706862;
		--text-muted: #A6A098;
		--text-placeholder: #C5BFB5;
		--text-disabled: #B5B0A8;
		--text-darker: #3D3834;
		--text-on-accent: #FFFFFF;

		--accent: #7B8C7C;
		--accent-hover: #627463;
		--accent-link: #5E7163;

		--border: rgba(215, 210, 200, 0.4);
		--border-subtle: rgba(230, 226, 216, 0.4);
		--border-strong: rgba(230, 226, 216, 0.6);
		--border-input: #E6E2D8;
		--border-hover: #D7D2C8;
		--border-focus: #D3D0C8;
		--border-table: #E6E2D8;
		--border-accent: rgba(215, 210, 200, 0.6);

		--scrollbar: #D5CFC6;
		--scrollbar-layout: #E8E4DB;

		--danger-bg: #FCE8E6;
		--danger-text: #B71C1C;
		--danger-btn: #D32F2F;
		--danger-btn-hover-bg: #FCE8E6;

		--stop-bg: #D37D7A;
		--stop-hover: #B8625F;

		--warn-bg: #FFF9E6;
		--warn-border: #FFE699;
		--warn-text: #6D5E00;
		--warn-card-bg: #FFF3E0;
		--warn-card-text: #E65100;
		--warm-accent: #D4A373;

		--bg-info: #FFF8E1;
		--info-text: #6D5E00;

		--code-text: #E6DCCE;
		--code-text-alt: #E8E3D9;

		--overlay: rgba(61, 56, 52, 0.3);
		--overlay-heavy: rgba(61, 56, 52, 0.4);

		--shadow-sm: 0 2px 8px rgba(61, 56, 52, 0.02);
		--shadow-md: 0 4px 12px rgba(61, 56, 52, 0.1);
		--shadow-lg: 0 12px 48px rgba(61, 56, 52, 0.12);
		--shadow-focus: 0 0 0 3px rgba(123, 140, 124, 0.15);
	}

	:global([data-theme="dark"]) {
		--bg-page: #1E1C1A;
		--bg-sidebar: #242220;
		--bg-surface: #2D2A27;
		--bg-surface-hover: #35322E;
		--bg-surface-active: #3D3935;
		--bg-surface-press: #3D3935;
		--bg-surface-alt: #2A2825;
		--bg-input: #252320;
		--bg-code: #2D2A27;
		--bg-tool: #2A2724;
		--bg-reasoning: #282522;
		--bg-done: #35322E;
		--bg-disabled: #2E2B28;
		--bg-secondary-btn: #2E2B28;
		--bg-table: #2E2B27;

		--text-primary: #E8E3D9;
		--text-secondary: #A69F96;
		--text-mid: #8A847B;
		--text-muted: #6E6860;
		--text-placeholder: #5A5550;
		--text-disabled: #4A4642;
		--text-darker: #F0EBE2;
		--text-on-accent: #FFFFFF;

		--accent: #8FA390;
		--accent-hover: #7A8C7B;
		--accent-link: #8BA08E;

		--border: rgba(80, 76, 72, 0.4);
		--border-subtle: rgba(80, 76, 72, 0.3);
		--border-strong: rgba(70, 66, 62, 0.5);
		--border-input: #3D3935;
		--border-hover: #4A4642;
		--border-focus: #6E6860;
		--border-table: #3D3935;
		--border-accent: rgba(143, 163, 144, 0.2);

		--scrollbar: #3D3935;
		--scrollbar-layout: #35322E;

		--danger-bg: #3D2020;
		--danger-text: #E57373;
		--danger-btn: #EF5350;
		--danger-btn-hover-bg: #4D2828;

		--stop-bg: #C46B68;
		--stop-hover: #D48380;

		--warn-bg: #333028;
		--warn-border: #6B5E20;
		--warn-text: #D4B830;
		--warn-card-bg: #332E20;
		--warn-card-text: #FF8A65;
		--warm-accent: #D4A373;

		--bg-info: #333028;
		--info-text: #D4B830;

		--code-text: #E6DCCE;
		--code-text-alt: #E8E3D9;

		--overlay: rgba(0, 0, 0, 0.5);
		--overlay-heavy: rgba(0, 0, 0, 0.6);

		--shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.15);
		--shadow-md: 0 4px 12px rgba(0, 0, 0, 0.2);
		--shadow-lg: 0 12px 48px rgba(0, 0, 0, 0.3);
		--shadow-focus: 0 0 0 3px rgba(143, 163, 144, 0.25);
	}

	:global(body) {
		margin: 0;
		font-family: 'Noto Sans SC', 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		background: var(--bg-page);
		color: var(--text-primary);
		-webkit-font-smoothing: antialiased;
		line-height: 1.6;
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
		padding: 0 0.5rem;
		background: var(--bg-page);
		border-bottom: 1px solid var(--border);
		flex-shrink: 0;
		z-index: 10;
	}

	.app-title {
		font-weight: 500;
		font-size: 1.1rem;
		color: var(--text-primary);
		text-decoration: none;
	}

	.app-title:hover {
		color: var(--accent);
	}

	.icon-btn {
		width: 40px;
		height: 40px;
		border: none;
		border-radius: 50%;
		background: transparent;
		color: var(--text-mid);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		text-decoration: none;
		transition: background 0.2s;
	}

	.icon-btn:active {
		background: var(--bg-surface-press);
	}

	main {
		flex: 1;
		overflow: hidden;
		background: var(--bg-page);
		position: relative;
	}

	.scrim {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: var(--overlay);
		z-index: 40;
		animation: fadeIn 0.2s ease-out;
		backdrop-filter: blur(2px);
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}
</style>
