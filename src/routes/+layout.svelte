<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import SessionSidebar from '$lib/components/SessionSidebar.svelte';
	import { setContext } from 'svelte';

	let { children } = $props();
	
	let sidebarOpen = $state(false);
	
	function toggleSidebar() {
		sidebarOpen = !sidebarOpen;
	}
	
	function closeSidebar() {
		sidebarOpen = false;
	}
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
			<!-- Scrim when sidebar is open -->
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
	:global(body) {
		margin: 0;
		font-family: 'Noto Sans SC', 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		background: #FBF9F6;
		color: #4A4542;
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
		background: #FBF9F6;
		border-bottom: 1px solid rgba(215, 210, 200, 0.4);
		flex-shrink: 0;
		z-index: 10;
	}

	.app-title {
		font-weight: 500;
		font-size: 1.1rem;
		color: #4A4542;
		text-decoration: none;
	}

	.app-title:hover {
		color: #7B8C7C;
	}

	.icon-btn {
		width: 40px;
		height: 40px;
		border: none;
		border-radius: 50%;
		background: transparent;
		color: #706862;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		text-decoration: none;
		transition: background 0.2s;
	}

	.icon-btn:active {
		background: #E8E4DB;
	}

	main {
		flex: 1;
		overflow: hidden;
		background: #FBF9F6;
		position: relative;
	}

	.scrim {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(74, 69, 66, 0.3);
		z-index: 40;
		animation: fadeIn 0.2s ease-out;
		backdrop-filter: blur(2px);
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}
</style>
