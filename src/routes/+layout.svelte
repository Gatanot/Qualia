<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<nav class="nav">
	<a href="/" class="nav-brand">Qualia</a>
	<div class="nav-links">
		<a href="/">Home</a>
		<a href="/settings">Settings</a>
	</div>
</nav>

<main>
	{@render children()}
</main>

<style>
	:global(body) {
		margin: 0;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		background: #fafafa;
		color: #222;
	}

	.nav {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem 1.5rem;
		background: #fff;
		border-bottom: 1px solid #e0e0e0;
	}

	.nav-brand {
		font-weight: 700;
		font-size: 1.1rem;
		color: #1976d2;
		text-decoration: none;
	}

	.nav-links {
		display: flex;
		gap: 1.5rem;
	}

	.nav-links a {
		color: #555;
		text-decoration: none;
		font-size: 0.9rem;
	}

	.nav-links a:hover {
		color: #1976d2;
	}
</style>
