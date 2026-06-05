<script lang="ts">
	import type { AppConfig } from '$lib/config';
	import { loadSessions } from '$lib/session-store';
	import StorageToggle from '$lib/components/settings/StorageToggle.svelte';
	import PromptEditor from '$lib/components/settings/PromptEditor.svelte';
	import ProviderManager from '$lib/components/settings/ProviderManager.svelte';
	import AvatarEditor from '$lib/components/settings/AvatarEditor.svelte';
	import SummarizeSettings from '$lib/components/settings/SummarizeSettings.svelte';

	const TABS = [
		{ id: 'general', label: '常规' },
		{ id: 'provider', label: '供应商' },
		{ id: 'prompt', label: '提示词' },
		{ id: 'avatar', label: '头像' },
		{ id: 'summary', label: '摘要' }
	] as const;

	type TabId = (typeof TABS)[number]['id'];

	let config: AppConfig = $state({ providers: [], activeModel: '', storageEnabled: false, systemPrompt: '', customBrandIcon: false, autoSummarize: true, summaryMode: 'idle', summaryIdleHours: 8, summaryScheduleHour: 2, summaryIntervalMin: 30 });
	let loading = $state(true);
	let activeTab: TabId = $state('general');

	$effect(() => {
		loadConfig();
		loadSessions();
	});

	async function loadConfig() {
		loading = true;
		try {
			const res = await fetch('/api/config');
			if (res.ok) {
				config = await res.json();
			}
		} catch { /* ignore */ }
		loading = false;
	}

	async function toggleStorage() {
		const updated = { ...config, storageEnabled: !config.storageEnabled };
		const res = await fetch('/api/config', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'writeConfig', config: updated })
		});
		if (res.ok) {
			config = await res.json();
		}
	}

	async function saveSystemPrompt() {
		const res = await fetch('/api/config', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'writeConfig', config })
		});
		if (res.ok) {
			config = await res.json();
		}
	}

	function onProvidersChange(updated: Record<string, unknown>) {
		config = {
			...config,
			providers: updated.providers as AppConfig['providers'],
			activeModel: updated.activeModel as string
		};
	}

	async function saveSummarize() {
		const res = await fetch('/api/config', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'writeConfig', config })
		});
		if (res.ok) {
			config = await res.json();
		}
	}
</script>

<div class="settings">
	<div class="settings-inner">
		<h1>设置</h1>

		<nav class="tab-bar">
			{#each TABS as tab}
				<button
					class="tab-btn"
					class:active={activeTab === tab.id}
					onclick={() => (activeTab = tab.id)}
				>
					{tab.label}
				</button>
			{/each}
		</nav>

		<div class="tab-content">
			{#if activeTab === 'general'}
				<StorageToggle enabled={config.storageEnabled} ontoggle={toggleStorage} />
			{:else if activeTab === 'provider'}
				<ProviderManager
					providers={config.providers}
					loading={loading}
					onconfigchange={onProvidersChange}
				/>
			{:else if activeTab === 'prompt'}
				<PromptEditor bind:systemPrompt={config.systemPrompt} onsave={saveSystemPrompt} />
			{:else if activeTab === 'avatar'}
				<section class="section">
					<h2>头像</h2>
					<AvatarEditor
						customBrandIcon={config.customBrandIcon}
						onsave={() => loadConfig()}
						onreset={() => loadConfig()}
					/>
				</section>
			{:else if activeTab === 'summary'}
				<SummarizeSettings
					bind:enabled={config.autoSummarize}
					bind:mode={config.summaryMode}
					bind:idleHours={config.summaryIdleHours}
					bind:scheduleHour={config.summaryScheduleHour}
					bind:intervalMin={config.summaryIntervalMin}
					onchange={saveSummarize}
				/>
			{/if}
		</div>
	</div>
</div>

<style>
	.settings {
		height: 100%;
		overflow-y: auto;
		box-sizing: border-box;
		scrollbar-width: thin;
		scrollbar-color: var(--scrollbar) transparent;
	}

	.settings-inner {
		max-width: 760px;
		margin: 0 auto;
		padding: var(--space-3xl) var(--space-2xl);
	}

	h1 {
		font-size: var(--text-3xl);
		margin-bottom: var(--space-3xl);
		color: var(--text-primary);
		font-weight: 500;
		letter-spacing: -0.02em;
		font-family: var(--font-serif);
	}

	.tab-bar {
		display: flex;
		gap: 0;
		border-bottom: 1px solid var(--border-subtle);
		margin-bottom: var(--space-3xl);
	}

	.tab-btn {
		position: relative;
		padding: 0.75rem 1.5rem;
		border: none;
		background: transparent;
		color: var(--text-secondary);
		font-family: inherit;
		font-size: var(--text-base);
		font-weight: 400;
		cursor: pointer;
		transition: color 0.2s var(--ease-out);
	}

	.tab-btn:hover {
		color: var(--text-primary);
	}

	.tab-btn::after {
		content: '';
		position: absolute;
		bottom: -1px;
		left: 0;
		right: 0;
		height: 2px;
		background: var(--accent);
		border-radius: 2px 2px 0 0;
		transform: scaleX(0);
		transition: transform 0.25s var(--ease-out);
	}

	.tab-btn.active {
		color: var(--text-primary);
		font-weight: 500;
	}

	.tab-btn.active::after {
		transform: scaleX(1);
	}

	.section {
		margin-bottom: var(--space-4xl);
	}

	.section h2 {
		font-size: var(--text-xl);
		margin: 0 0 1.25rem;
		color: var(--text-primary);
		font-weight: 500;
	}
</style>
