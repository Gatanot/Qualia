<script lang="ts">
	import { loadSessions } from '$lib/session-store';
	import EmptyState from '$lib/components/EmptyState.svelte';

	$effect(() => {
		loadSessions();
	});
</script>

<div class="root-page">
	<EmptyState />
</div>

<style>
	.root-page {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
	}
</style>
