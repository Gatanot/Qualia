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
	import CompressSettings from '$lib/components/settings/CompressSettings.svelte';
	import TaskManager from '$lib/components/settings/TaskManager.svelte';
	import EmailSettings from '$lib/components/settings/EmailSettings.svelte';
	import TelegramSettings from '$lib/components/settings/TelegramSettings.svelte';

	const TABS = [
		{ id: 'general', label: '常规' },
		{ id: 'provider', label: '供应商' },
		{ id: 'notify', label: '通知' },
		{ id: 'summary', label: '摘要' },
		{ id: 'compress', label: '压缩' },
		{ id: 'search', label: '搜索' },
		{ id: 'tasks', label: '任务' }
	] as const;

	type TabId = (typeof TABS)[number]['id'];

	let config = $state<AppConfig & { defaultWorkspace?: string }>({ providers: [], activeModel: '', storageEnabled: false, systemPrompt: '', customBrandIcon: false, autoSummarize: true, summaryMode: 'idle', summaryIdleHours: 8, summaryScheduleHour: 2, summaryIntervalMin: 30, compressionMode: 'auto', compressionThreshold: 256000, searchEnabled: false, searchProvider: 'searxng', searxngURL: 'http://localhost:8080', tavilyApiKey: '', emailNotifications: false, emailSmtpHost: '', emailSmtpPort: 465, emailSmtpSecure: true, emailSmtpUser: '', emailSmtpPass: '', emailFrom: '', emailTo: '', telegramEnabled: false, telegramBotToken: '', telegramAllowedUsers: '', defaultWorkspace: '' });
	let loading = $state(true);
	let activeTab: TabId = $state('general');
	let importMessage = $state('');
	let importOk = $state(false);

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

	async function saveConfig() {
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

	async function saveCompress() {
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

	function exportConfig() {
		const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'qualia-config.json';
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}

	async function importConfig(files: FileList | null) {
		if (!files || files.length === 0) return;
		importMessage = '';
		importOk = false;
		try {
			const text = await files[0].text();
			const imported = JSON.parse(text);
			const res = await fetch('/api/config', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'importConfig', config: imported })
			});
			if (res.ok) {
				importMessage = '配置导入成功';
				importOk = true;
				await loadConfig();
			} else {
				const err = await res.json();
				importMessage = err.error || '导入失败';
			}
		} catch (e) {
			importMessage = '文件解析失败，请确认是有效的 JSON 配置文件';
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
				<section class="section">
					<h2>导入 / 导出</h2>
					<p class="section-desc">导出当前所有设置为 JSON 文件，或从文件导入设置。导入时不会删除已有供应商，同名供应商会合并更新。</p>
					<div class="impexp-buttons">
						<button class="action-btn" onclick={exportConfig}>导出设置</button>
						<label class="action-btn">
							导入设置
							<input type="file" accept=".json" hidden onchange={(e) => importConfig((e.target as HTMLInputElement).files)} />
						</label>
					</div>
					{#if importMessage}
						<p class="import-msg" class:ok={importOk}>{importMessage}</p>
					{/if}
				</section>
			<section class="section">
					<h2>默认工作区</h2>
					<p class="section-desc">后台任务（摘要等）使用的工作区路径。留空则使用启动时的当前目录。注意：日记固定使用 ~/.qualia/data/ 路径，不受此设置影响。</p>
					<input
						type="text"
						class="workspace-input"
						bind:value={config.defaultWorkspace}
						placeholder="例如 /home/user/project（留空 = 当前目录）"
						onchange={() => saveConfig()}
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
					bind:enabled={config.telegramEnabled}
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
			{:else if activeTab === 'compress'}
				<CompressSettings
					bind:mode={config.compressionMode}
					bind:threshold={config.compressionThreshold}
					onchange={saveCompress}
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

	.section-desc {
		font-size: var(--text-sm);
		color: var(--text-secondary);
		margin: 0 0 1rem;
		line-height: 1.6;
	}

	.impexp-buttons {
		display: flex;
		gap: 0.75rem;
	}

	.action-btn {
		display: inline-flex;
		align-items: center;
		padding: 0.6rem 1.25rem;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		background: var(--bg);
		color: var(--text-primary);
		font-family: inherit;
		font-size: var(--text-sm);
		cursor: pointer;
		transition: background 0.2s var(--ease-out), border-color 0.2s var(--ease-out);
	}

	.action-btn:hover {
		background: var(--hover);
		border-color: var(--border);
	}

	.import-msg {
		margin-top: 0.75rem;
		font-size: var(--text-sm);
		color: var(--text-secondary);
	}

	.import-msg.ok {
		color: var(--success);
	}

	.workspace-input {
		width: 100%;
		max-width: 480px;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--bg);
		color: var(--text-primary);
		font-family: var(--font-mono);
		font-size: var(--text-sm);
	}
</style>
