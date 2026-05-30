<script lang="ts">
	import { goto } from '$app/navigation';
	import { loadSessions, createSession, pendingFirstMessage } from '$lib/session-store';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import ChatInput from '$lib/components/ChatInput.svelte';

	let input = $state('');
	let sending = $state(false);

	$effect(() => {
		loadSessions();
	});

	async function handleSend() {
		const text = input.trim();
		if (!text || sending) return;
		sending = true;
		input = '';

		const session = await createSession();
		if (!session) { sending = false; return; }

		pendingFirstMessage.set(text);
		goto('/chat/' + session.id);
	}
</script>

<div class="root-page">
	<div class="welcome-area">
		<EmptyState />
		<div class="input-anchor">
			<ChatInput
				bind:value={input}
				streaming={false}
				queueCount={0}
				onsend={handleSend}
				onstop={() => {}}
			/>
		</div>
	</div>
</div>

<style>
	.root-page {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
	}

	.welcome-area {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2rem;
		width: 100%;
		max-width: 700px;
		padding: 2rem;
	}

	.input-anchor {
		width: 100%;
	}
</style>
