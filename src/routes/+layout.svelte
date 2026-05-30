<script lang="ts">
	import { page } from '$app/stores';
	import favicon from '$lib/assets/favicon.svg';
	import SessionSidebar from '$lib/components/SessionSidebar.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
	<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap" rel="stylesheet" />
	<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,0,0" rel="stylesheet" />
</svelte:head>

<div class="app">
	<nav class="nav">
		<a href="/" class="nav-brand">
			<span class="material-symbols-rounded brand-icon">spa</span>
			Qualia
		</a>
		<div class="nav-links">
			<a href="/settings" class:active={$page.url.pathname === '/settings'}>设置</a>
		</div>
	</nav>

	<div class="app-body">
		<SessionSidebar />
		<main>
			{@render children()}
		</main>
	</div>
</div>

<style>
	:global(body) {
		margin: 0;
		font-family: 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		background: #FAF8F5;
		color: #3D3834;
		-webkit-font-smoothing: antialiased;
	}

	.app {
		display: flex;
		flex-direction: column;
		height: 100vh;
	}

	.nav {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0 2rem;
		height: 64px;
		background: #FAF8F5;
		color: #3D3834;
		border-bottom: 1px solid rgba(230, 226, 216, 0.6);
		z-index: 20;
		flex-shrink: 0;
	}

	.nav-brand {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-weight: 500;
		font-size: 1.25rem;
		color: #3D3834;
		text-decoration: none;
		letter-spacing: 0.2px;
	}

	.brand-icon {
		color: #6B7F72;
		font-size: 24px;
	}

	.nav-links {
		display: flex;
		gap: 0.5rem;
	}

	.nav-links a {
		color: #706862;
		text-decoration: none;
		font-size: 0.95rem;
		font-weight: 500;
		padding: 0.5rem 1.25rem;
		border-radius: 100px;
		transition: background-color 0.2s ease, color 0.2s ease;
	}

	.nav-links a:hover {
		background: #F0EBE1;
		color: #3D3834;
	}

	.nav-links a.active {
		background: #E8E3D9;
		color: #3D3834;
	}

	.app-body {
		display: flex;
		flex: 1;
		overflow: hidden;
	}

	main {
		flex: 1;
		overflow: hidden;
	}
</style>
