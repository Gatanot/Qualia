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
		--shadow-elevate: 0 8px 32px rgba(74, 69, 66, 0.08), 0 2px 8px rgba(74, 69, 66, 0.04);
		--shadow-elevate-focus: 0 12px 48px rgba(74, 69, 66, 0.12), 0 4px 16px rgba(74, 69, 66, 0.06);
		--shadow-accent-btn: 0 4px 12px rgba(123, 140, 124, 0.15);
		--shadow-accent-btn-hover: 0 6px 16px rgba(123, 140, 124, 0.25);
		--shadow-accent-btn-active: 0 2px 8px rgba(123, 140, 124, 0.2);
		--shadow-bubble: 0 4px 20px rgba(74, 69, 66, 0.04), 0 1px 3px rgba(74, 69, 66, 0.02);
		--shadow-bubble-user: 0 4px 20px rgba(123, 140, 124, 0.15), 0 1px 3px rgba(123, 140, 124, 0.1);
		--shadow-stop-hover: 0 6px 16px rgba(211, 125, 122, 0.25);
		--shadow-modal: 0 12px 48px rgba(61, 56, 52, 0.15);
		--shadow-sidebar: 2px 0 12px rgba(74, 69, 66, 0.15);
		--shadow-knob: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	:global([data-theme="dark"]) {
		--bg-page: #1A1816;
		--bg-sidebar: #201E1B;
		--bg-surface: #282522;
		--bg-surface-hover: #302D29;
		--bg-surface-active: #373430;
		--bg-surface-press: #3B3834;
		--bg-surface-alt: #25221F;
		--bg-input: #22201D;
		--bg-code: #22201D;
		--bg-tool: #25221F;
		--bg-reasoning: #23201D;
		--bg-done: #302D29;
		--bg-disabled: #2A2724;
		--bg-secondary-btn: #2A2724;
		--bg-table: #2A2724;

		--text-primary: #E4DFD4;
		--text-secondary: #A3988E;
		--text-mid: #867E75;
		--text-muted: #6B645D;
		--text-placeholder: #57524C;
		--text-disabled: #4A4640;
		--text-darker: #ECE7DD;
		--text-on-accent: #FFFFFF;

		--accent: #8BA08D;
		--accent-hover: #7A8F7C;
		--accent-link: #8EA390;

		--border: rgba(90, 84, 78, 0.35);
		--border-subtle: rgba(90, 84, 78, 0.25);
		--border-strong: rgba(80, 75, 69, 0.45);
		--border-input: #36322E;
		--border-hover: #45403C;
		--border-focus: #6B645D;
		--border-table: #36322E;
		--border-accent: rgba(139, 160, 141, 0.18);

		--scrollbar: #383430;
		--scrollbar-layout: #322E2A;

		--danger-bg: #362022;
		--danger-text: #E88380;
		--danger-btn: #F28885;
		--danger-btn-hover-bg: #46282A;

		--stop-bg: #B86360;
		--stop-hover: #CF7B78;

		--warn-bg: #2F2B20;
		--warn-border: #5E5218;
		--warn-text: #CEB540;
		--warn-card-bg: #302B1C;
		--warn-card-text: #FF9868;
		--warm-accent: #D4A373;

		--bg-info: #2F2B20;
		--info-text: #CEB540;

		--code-text: #D6CCBF;
		--code-text-alt: #E8E3D9;

		--overlay: rgba(0, 0, 0, 0.5);
		--overlay-heavy: rgba(0, 0, 0, 0.6);

		--shadow-sm: none;
		--shadow-md: none;
		--shadow-lg: 0 12px 48px rgba(0, 0, 0, 0.25);
		--shadow-focus: 0 0 0 3px rgba(139, 160, 141, 0.3);
		--shadow-elevate: 0 0 0 1px rgba(139, 160, 141, 0.08);
		--shadow-elevate-focus: 0 0 0 1px rgba(139, 160, 141, 0.15);
		--shadow-accent-btn: 0 2px 8px rgba(0, 0, 0, 0.2);
		--shadow-accent-btn-hover: 0 4px 16px rgba(0, 0, 0, 0.3);
		--shadow-accent-btn-active: 0 1px 4px rgba(0, 0, 0, 0.15);
		--shadow-bubble: 0 0 0 1px rgba(90, 84, 78, 0.15);
		--shadow-bubble-user: 0 2px 12px rgba(0, 0, 0, 0.2);
		--shadow-stop-hover: 0 6px 16px rgba(0, 0, 0, 0.3);
		--shadow-modal: 0 12px 48px rgba(0, 0, 0, 0.4);
		--shadow-sidebar: 2px 0 16px rgba(0, 0, 0, 0.3);
		--shadow-knob: 0 2px 4px rgba(0, 0, 0, 0.2);
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
