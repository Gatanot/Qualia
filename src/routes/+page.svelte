<script lang="ts">
	import { goto } from '$app/navigation';
	import { sessions, loadSessions } from '$lib/session-store';
	import EmptyState from '$lib/components/EmptyState.svelte';

	$effect(() => {
		loadSessions().then(() => {
			if ($sessions.length > 0) {
				goto('/chat/' + $sessions[0].id, { replaceState: true });
			}
		});
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
