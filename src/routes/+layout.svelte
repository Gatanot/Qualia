<script lang="ts">
	import { page } from '$app/stores';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
	<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap" rel="stylesheet" />
	<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,0,0" rel="stylesheet" />
</svelte:head>

<nav class="nav">
	<a href="/" class="nav-brand">Qualia</a>
	<div class="nav-links">
		<a href="/" class:active={$page.url.pathname === '/'}>对话</a>
		<a href="/settings" class:active={$page.url.pathname === '/settings'}>设置</a>
	</div>
</nav>

<main>
	{@render children()}
</main>

<style>
	:global(body) {
		margin: 0;
		font-family: 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		background: #f5f5f5;
		color: #212121;
	}

	.nav {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0 1.5rem;
		height: 56px;
		background: #1976d2;
		color: #fff;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
		position: relative;
		z-index: 10;
	}

	.nav-brand {
		font-weight: 700;
		font-size: 1.15rem;
		color: #fff;
		text-decoration: none;
		letter-spacing: 0.5px;
	}

	.nav-links {
		display: flex;
		gap: 0.25rem;
	}

	.nav-links a {
		color: rgba(255, 255, 255, 0.85);
		text-decoration: none;
		font-size: 0.875rem;
		font-weight: 500;
		padding: 0.5rem 1rem;
		border-radius: 4px;
		transition: background 0.2s;
	}

	.nav-links a:hover,
	.nav-links a.active {
		background: rgba(255, 255, 255, 0.15);
		color: #fff;
	}
</style>
