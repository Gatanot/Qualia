<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import SessionSidebar from '$lib/components/SessionSidebar.svelte';
	import { initTheme } from '$lib/theme';

	let { children } = $props();

	let sidebarOpen = $state(false);
	let customIcon = $state(false);

	function toggleSidebar() {
		sidebarOpen = !sidebarOpen;
	}

	function closeSidebar() {
		sidebarOpen = false;
	}

	$effect(() => {
		initTheme();
		fetch('/api/config')
			.then((r) => r.json())
			.then((c) => { customIcon = c.customBrandIcon === true; })
			.catch(() => {});
	});
</script>

<svelte:head>
	<title>Qualia</title>
	<link rel="icon" href={favicon} />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
	<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700&family=Noto+Serif+SC:wght@400;700&family=Roboto:wght@300;400;500;700&display=swap" rel="stylesheet" />
	<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,0,0" rel="stylesheet" />
</svelte:head>

<div class="app">
	<SessionSidebar bind:mobileOpen={sidebarOpen} customIcon={customIcon} />

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
		--bg-page: #FDFCF8;
		--bg-sidebar: #F6F4EE;
		--bg-surface: #FFFEFC;
		--bg-surface-hover: #F2EFE8;
		--bg-surface-active: #EBE7DF;
		--bg-surface-press: #E6E1D8;
		--bg-surface-alt: #F9F8F5;
		--bg-input: #F9F8F5;
		--bg-code: #2E2B29;
		--bg-tool: #F5F3EC;
		--bg-reasoning: #F9F7F1;
		--bg-done: #F2EFE8;
		--bg-disabled: #EEECE4;
		--bg-secondary-btn: #FBF9F5;
		--bg-table: #F3EFE6;

		--text-primary: #3E3A37;
		--text-secondary: #7D7670;
		--text-mid: #68625E;
		--text-muted: #A39D95;
		--text-placeholder: #C5BFB5;
		--text-disabled: #B8B3AA;
		--text-darker: #332F2D;
		--text-on-accent: #FFFFFF;

		--accent: #807361;
		--accent-hover: #6B5F4E;
		--accent-link: #786C5A;

		--border: rgba(210, 203, 190, 0.45);
		--border-subtle: rgba(225, 218, 205, 0.4);
		--border-strong: rgba(225, 218, 205, 0.7);
		--border-input: #E4DECF;
		--border-hover: #D8D1C2;
		--border-focus: #D0C9B8;
		--border-table: #E4DECF;
		--border-accent: rgba(210, 203, 190, 0.6);

		--scrollbar: #D4CDBE;
		--scrollbar-layout: #EBE5D8;

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

		--shadow-sm: 0 2px 10px rgba(70, 65, 60, 0.03);
		--shadow-md: 0 6px 16px rgba(70, 65, 60, 0.08);
		--shadow-lg: 0 16px 40px rgba(70, 65, 60, 0.1);
		--shadow-focus: 0 0 0 3px rgba(128, 115, 97, 0.15);
		--shadow-elevate: 0 8px 32px rgba(80, 75, 70, 0.06), 0 2px 8px rgba(80, 75, 70, 0.03);
		--shadow-elevate-focus: 0 12px 40px rgba(80, 75, 70, 0.1), 0 4px 16px rgba(80, 75, 70, 0.05);
		--shadow-accent-btn: 0 4px 12px rgba(128, 115, 97, 0.18);
		--shadow-accent-btn-hover: 0 6px 16px rgba(107, 95, 78, 0.25);
		--shadow-accent-btn-active: 0 2px 8px rgba(107, 95, 78, 0.2);
		--shadow-bubble: 0 4px 24px rgba(80, 75, 70, 0.05), 0 1px 4px rgba(80, 75, 70, 0.02);
		--shadow-bubble-user: 0 4px 20px rgba(128, 115, 97, 0.18), 0 1px 3px rgba(128, 115, 97, 0.1);
		--shadow-stop-hover: 0 6px 16px rgba(211, 125, 122, 0.25);
		--shadow-modal: 0 16px 48px rgba(70, 65, 60, 0.12);
		--shadow-sidebar: 2px 0 16px rgba(80, 75, 70, 0.1);
		--shadow-knob: 0 2px 6px rgba(90, 85, 80, 0.12);
	}

	:global([data-theme="dark"]) {
		--bg-page: #1E1B19;
		--bg-sidebar: #25211E;
		--bg-surface: #2C2724;
		--bg-surface-hover: #342F2B;
		--bg-surface-active: #3C3632;
		--bg-surface-press: #413B36;
		--bg-surface-alt: #292421;
		--bg-input: #26221F;
		--bg-code: #25211E;
		--bg-tool: #292421;
		--bg-reasoning: #272320;
		--bg-done: #342F2B;
		--bg-disabled: #2E2926;
		--bg-secondary-btn: #2E2926;
		--bg-table: #2E2926;

		--text-primary: #E8E2D9;
		--text-secondary: #A89F95;
		--text-mid: #8C8379;
		--text-muted: #706860;
		--text-placeholder: #5A534C;
		--text-disabled: #4D4741;
		--text-darker: #F0EBE3;
		--text-on-accent: #FFFFFF;

		--accent: #9A8A76;
		--accent-hover: #8A7B68;
		--accent-link: #948572;

		--border: rgba(100, 92, 85, 0.35);
		--border-subtle: rgba(100, 92, 85, 0.25);
		--border-strong: rgba(90, 82, 75, 0.45);
		--border-input: #3E3833;
		--border-hover: #4D4640;
		--border-focus: #736A62;
		--border-table: #3E3833;
		--border-accent: rgba(154, 138, 118, 0.18);

		--scrollbar: #403A35;
		--scrollbar-layout: #3A342F;

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
		--shadow-md: 0 4px 16px rgba(0, 0, 0, 0.15);
		--shadow-lg: 0 16px 48px rgba(0, 0, 0, 0.3);
		--shadow-focus: 0 0 0 3px rgba(154, 138, 118, 0.3);
		--shadow-elevate: 0 0 0 1px rgba(154, 138, 118, 0.08), 0 8px 32px rgba(0, 0, 0, 0.2);
		--shadow-elevate-focus: 0 0 0 1px rgba(154, 138, 118, 0.15), 0 12px 48px rgba(0, 0, 0, 0.3);
		--shadow-accent-btn: 0 2px 12px rgba(0, 0, 0, 0.25);
		--shadow-accent-btn-hover: 0 4px 20px rgba(0, 0, 0, 0.35);
		--shadow-accent-btn-active: 0 1px 4px rgba(0, 0, 0, 0.2);
		--shadow-bubble: 0 0 0 1px rgba(100, 92, 85, 0.15), 0 4px 20px rgba(0, 0, 0, 0.15);
		--shadow-bubble-user: 0 4px 20px rgba(0, 0, 0, 0.3);
		--shadow-stop-hover: 0 6px 16px rgba(0, 0, 0, 0.35);
		--shadow-modal: 0 16px 48px rgba(0, 0, 0, 0.5);
		--shadow-sidebar: 2px 0 20px rgba(0, 0, 0, 0.35);
		--shadow-knob: 0 2px 6px rgba(0, 0, 0, 0.3);
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
		transition: background-color 0.4s ease, color 0.4s ease, border-color 0.4s ease;
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
		font-weight: 700;
		font-family: 'Noto Serif SC', 'Noto Sans SC', serif;
		font-size: 1.25rem;
		color: var(--text-primary);
		text-decoration: none;
		letter-spacing: 0.03em;
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
