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
		background: #FDFBF7;
		color: #4A433E;
	}

	.nav {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0 1.5rem;
		height: 64px;
		background: #FDFBF7;
		color: #4A433E;
		border-bottom: 1px solid #EAE4DC;
		position: relative;
		z-index: 10;
	}

	.nav-brand {
		font-weight: 500;
		font-size: 1.2rem;
		color: #4A433E;
		text-decoration: none;
		letter-spacing: 0.2px;
	}

	.nav-links {
		display: flex;
		gap: 0.5rem;
	}

	.nav-links a {
		color: #8C847D;
		text-decoration: none;
		font-size: 0.9rem;
		font-weight: 500;
		padding: 0.5rem 1.25rem;
		border-radius: 24px;
		transition: all 0.2s ease;
	}

	.nav-links a:hover {
		background: #F4EFE6;
		color: #4A433E;
	}
	
	.nav-links a.active {
		background: #EAE4DC;
		color: #4A433E;
	}
</style>
