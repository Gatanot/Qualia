<script lang="ts">
	import type { AppConfig } from '$lib/config';
	import { loadSessions } from '$lib/session-store';
	import StorageToggle from '$lib/components/settings/StorageToggle.svelte';
	import PromptEditor from '$lib/components/settings/PromptEditor.svelte';
	import ProviderManager from '$lib/components/settings/ProviderManager.svelte';
	import AvatarEditor from '$lib/components/settings/AvatarEditor.svelte';
	import SummarizeSettings from '$lib/components/settings/SummarizeSettings.svelte';

	let config: AppConfig = $state({ providers: [], activeProvider: '', storageEnabled: false, systemPrompt: '', customBrandIcon: false, autoSummarize: true, summaryMode: 'idle', summaryIdleHours: 8, summaryScheduleHour: 2, summaryIntervalMin: 30 });
	let loading = $state(true);

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
			activeProvider: updated.activeProvider as string
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

		<StorageToggle enabled={config.storageEnabled} ontoggle={toggleStorage} />

		<SummarizeSettings
			bind:enabled={config.autoSummarize}
			bind:mode={config.summaryMode}
			bind:idleHours={config.summaryIdleHours}
			bind:scheduleHour={config.summaryScheduleHour}
			bind:intervalMin={config.summaryIntervalMin}
			onchange={saveSummarize}
		/>

		<section class="section">
			<h2>头像</h2>
			<AvatarEditor
				customBrandIcon={config.customBrandIcon}
				onsave={() => loadConfig()}
				onreset={() => loadConfig()}
			/>
		</section>

		<PromptEditor bind:systemPrompt={config.systemPrompt} onsave={saveSystemPrompt} />

		<ProviderManager
			providers={config.providers}
			activeProvider={config.activeProvider}
			loading={loading}
			onconfigchange={onProvidersChange}
		/>
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
