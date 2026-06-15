<script lang="ts">
	import type { AppConfig } from '$lib/config';
	import { loadSessions } from '$lib/session-store';
	import { pickerState } from '$lib/model-picker-state.svelte';
	import StorageToggle from '$lib/components/settings/StorageToggle.svelte';
	import PromptEditor from '$lib/components/settings/PromptEditor.svelte';
	import ProviderManager from '$lib/components/settings/ProviderManager.svelte';
	import AvatarEditor from '$lib/components/settings/AvatarEditor.svelte';
	import SummarizeSettings from '$lib/components/settings/SummarizeSettings.svelte';
	import SearchSettings from '$lib/components/settings/SearchSettings.svelte';
	import TaskManager from '$lib/components/settings/TaskManager.svelte';
	import EmailSettings from '$lib/components/settings/EmailSettings.svelte';
	import TelegramSettings from '$lib/components/settings/TelegramSettings.svelte';

	const TABS = [
		{ id: 'general', label: '常规' },
		{ id: 'provider', label: '供应商' },
		{ id: 'notify', label: '通知' },
		{ id: 'summary', label: '摘要' },
		{ id: 'search', label: '搜索' },
		{ id: 'tasks', label: '任务' }
	] as const;

	type TabId = (typeof TABS)[number]['id'];

	let config: AppConfig = $state({ providers: [], activeModel: '', storageEnabled: false, systemPrompt: '', customBrandIcon: false, autoSummarize: true, summaryMode: 'idle', summaryIdleHours: 8, summaryScheduleHour: 2, summaryIntervalMin: 30, searchEnabled: false, searchProvider: 'searxng', searxngURL: 'http://localhost:8080', tavilyApiKey: '', emailNotifications: false, emailSmtpHost: '', emailSmtpPort: 465, emailSmtpSecure: true, emailSmtpUser: '', emailSmtpPass: '', emailFrom: '', emailTo: '', telegramBotToken: '', telegramAllowedUsers: '' });
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

	async function onProvidersChange(updated: Record<string, unknown>) {
		config = {
			...config,
			providers: updated.providers as AppConfig['providers'],
			activeModel: updated.activeModel as string
		};
		pickerState.config = config;
		const modelsRes = await fetch('/api/models');
		if (modelsRes.ok) {
			pickerState.allModels = await modelsRes.json();
		}
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

	async function saveSearch() {
		const res = await fetch('/api/config', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'writeConfig', config })
		});
		if (res.ok) {
			config = await res.json();
		}
	}

	async function saveNotifications() {
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
				<PromptEditor bind:systemPrompt={config.systemPrompt} onsave={saveSystemPrompt} />
				<section class="section">
					<h2>头像</h2>
					<AvatarEditor
						customBrandIcon={config.customBrandIcon}
						onsave={() => loadConfig()}
						onreset={() => loadConfig()}
					/>
				</section>
			{:else if activeTab === 'provider'}
				<ProviderManager
					providers={config.providers}
					loading={loading}
					onconfigchange={onProvidersChange}
				/>
			{:else if activeTab === 'notify'}
				<EmailSettings
					bind:notifications={config.emailNotifications}
					bind:smtpHost={config.emailSmtpHost}
					bind:smtpPort={config.emailSmtpPort}
					bind:smtpSecure={config.emailSmtpSecure}
					bind:smtpUser={config.emailSmtpUser}
					bind:smtpPass={config.emailSmtpPass}
					bind:emailFrom={config.emailFrom}
					bind:emailTo={config.emailTo}
					onchange={saveNotifications}
				/>
				<TelegramSettings
					bind:botToken={config.telegramBotToken}
					bind:allowedUsers={config.telegramAllowedUsers}
					onchange={saveNotifications}
				/>
			{:else if activeTab === 'summary'}
				<SummarizeSettings
					bind:enabled={config.autoSummarize}
					bind:mode={config.summaryMode}
					bind:idleHours={config.summaryIdleHours}
					bind:scheduleHour={config.summaryScheduleHour}
					bind:intervalMin={config.summaryIntervalMin}
					onchange={saveSummarize}
				/>
			{:else if activeTab === 'search'}
				<SearchSettings
					bind:enabled={config.searchEnabled}
					bind:provider={config.searchProvider}
					bind:searxngURL={config.searxngURL}
					bind:tavilyApiKey={config.tavilyApiKey}
					onchange={saveSearch}
				/>
			{:else if activeTab === 'tasks'}
				<TaskManager />
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
