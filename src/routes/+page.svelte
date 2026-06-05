<script lang="ts">
	import { goto } from '$app/navigation';
	import { loadSessions, createSession, pendingFirstMessage } from '$lib/session-store';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import ChatInput from '$lib/components/ChatInput.svelte';

	let input = $state('');
	let sending = $state(false);
	let hasProvider = $state(false);
	let checkedProvider = $state(false);
	let showNoProviderHint = $state(false);
	let customIcon = $state(false);

	$effect(() => {
		loadSessions();
		fetch('/api/config')
			.then((r) => r.json())
			.then((config) => {
				hasProvider = !!(config.providers?.length > 0);
				checkedProvider = true;
				customIcon = config.customBrandIcon === true;
			})
			.catch(() => { checkedProvider = true; });
	});

	async function handleSend() {
		const text = input.trim();
		if (!text || sending) return;

		if (checkedProvider && !hasProvider) {
			showNoProviderHint = true;
			return;
		}

		sending = true;
		input = '';
		showNoProviderHint = false;

		const session = await createSession();
		if (!session) { sending = false; return; }

		pendingFirstMessage.set(text);
		goto('/chat/' + session.id);
	}
</script>

<div class="root-page">
	<div class="welcome-area">
		<EmptyState customIcon={customIcon} />
		<div class="input-anchor">
			<ChatInput
				bind:value={input}
				streaming={false}
				queueCount={0}
				onsend={handleSend}
				onstop={() => {}}
			/>
			{#if showNoProviderHint}
				<div class="no-provider-hint">
					<span class="material-symbols-rounded hint-icon">info</span>
					<span>尚未配置 AI 供应商，请先前往 <a href="/settings" class="hint-link">设置</a> 添加</span>
				</div>
			{/if}
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
		gap: 2.25rem;
		width: 100%;
		max-width: 700px;
		padding: 2rem;
	}

	.input-anchor {
		width: 100%;
	}

	.no-provider-hint {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 1rem;
		padding: 0.85rem 1.25rem;
		background: var(--bg-info);
		border: 1px solid var(--warn-border);
		border-radius: var(--radius-lg);
		font-size: var(--text-base);
		color: var(--info-text);
		animation: hintEnter 0.35s var(--ease-out);
	}

	.hint-icon {
		font-size: 20px;
		flex-shrink: 0;
	}

	.hint-link {
		color: var(--accent);
		font-weight: 500;
		text-decoration: underline;
		text-underline-offset: 2px;
		transition: color 0.2s var(--ease-out);
	}

	.hint-link:hover {
		color: var(--accent-hover);
	}

	@keyframes hintEnter {
		from { opacity: 0; transform: translateY(8px); }
		to { opacity: 1; transform: translateY(0); }
	}
</style>
