<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import SessionSidebar from '$lib/components/SessionSidebar.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
	<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700&family=Roboto:wght@300;400;500;700&display=swap" rel="stylesheet" />
	<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,0,0" rel="stylesheet" />
</svelte:head>

<div class="app">
	<SessionSidebar />
	<main>
		{@render children()}
	</main>
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
		height: 100vh;
		overflow: hidden;
	}

	main {
		flex: 1;
		overflow: hidden;
		background: #FBF9F6;
	}
</style>
