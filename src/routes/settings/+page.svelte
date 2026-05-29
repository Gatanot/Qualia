<script lang="ts">
	import type { AppConfig, ProviderConfig } from '$lib/config';

	let config: AppConfig = $state({ providers: [], activeProvider: '', storageEnabled: true, systemPrompt: '' });
	let loading = $state(true);
	let error = $state('');
	let editingProvider: ProviderConfig | null = $state(null);
	let showForm = $state(false);

	$effect(() => {
		loadConfig();
	});

	async function loadConfig() {
		loading = true;
		error = '';
		try {
			const res = await fetch('/api/config');
			if (res.ok) {
				config = await res.json();
			} else {
				error = '加载配置失败';
			}
		} catch {
			error = '无法连接到服务器';
		}
		loading = false;
	}

	async function handleSubmit(e: Event) {
		const form = e.target as HTMLFormElement;
		const fd = new FormData(form);

		const provider: ProviderConfig = {
			type: 'openai',
			name: (fd.get('name') as string).trim(),
			apiKey: (fd.get('apiKey') as string).trim(),
			baseURL: (fd.get('baseURL') as string).trim(),
			model: (fd.get('model') as string).trim()
		};

		if (!provider.name || !provider.apiKey || !provider.baseURL || !provider.model) {
			error = '所有字段必填';
			return;
		}

		const res = await fetch('/api/config', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'addProvider', provider })
		});

		if (res.ok) {
			config = await res.json();
			showForm = false;
			editingProvider = null;
			form.reset();
			error = '';
		} else {
			const data = await res.json();
			error = data.error || '保存供应商失败';
		}
	}

	async function removeProvider(name: string) {
		const res = await fetch('/api/config', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'removeProvider', name })
		});

		if (res.ok) {
			config = await res.json();
		}
	}

	async function setActive(name: string) {
		const res = await fetch('/api/config', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'setActiveProvider', name })
		});

		if (res.ok) {
			config = await res.json();
		}
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

	function editProvider(p: ProviderConfig) {
		editingProvider = p;
		showForm = true;
	}

	function maskKey(key: string): string {
		if (key.length <= 8) return '****';
		return key.slice(0, 4) + '****' + key.slice(-4);
	}

	function cancelForm() {
		showForm = false;
		editingProvider = null;
		error = '';
	}
</script>

<svelte:head>
	<title>设置 — Qualia</title>
</svelte:head>

<div class="settings">
	<h1>设置</h1>

	<section class="section">
		<h2>常规</h2>
		<div class="setting-row">
			<div class="setting-label">
				<div class="setting-title">对话存储</div>
				<div class="setting-desc">
					{#if config.storageEnabled}
						已开启 — 对话历史持久化到本地数据库
					{:else}
						已关闭 — 数据仅保存在内存，重启后丢失（适合开发测试）
					{/if}
				</div>
			</div>
			<button
				class="toggle"
				class:on={config.storageEnabled}
				onclick={toggleStorage}
				aria-label="切换存储开关"
			>
				<span class="toggle-knob"></span>
			</button>
		</div>
	</section>

	<section class="section">
		<h2>系统提示词</h2>
		<p class="section-desc">定义 AI 的角色和行为准则，将作为每条对话的 system prompt 发送给模型。</p>
		<textarea
			class="prompt-editor"
			bind:value={config.systemPrompt}
			rows={10}
			placeholder="输入系统提示词..."
		></textarea>
		<div class="prompt-actions">
			<span class="prompt-hint">{config.systemPrompt?.length || 0} 字符</span>
			<button class="btn btn-primary" onclick={saveSystemPrompt}>保存提示词</button>
		</div>
	</section>

	<section class="section">
		<div class="section-header">
			<h2>AI 供应商</h2>
			<button class="btn btn-primary" onclick={() => (showForm = true)}>
				+ 添加供应商
			</button>
		</div>

		{#if error}
			<div class="msg msg-error">{error}</div>
		{/if}

		{#if loading}
			<p class="msg">加载中...</p>
		{:else if config.providers.length === 0}
			<p class="msg">尚未配置供应商，请添加一个开始使用</p>
		{:else}
			<div class="provider-list">
				{#each config.providers as p (p.name)}
					<div class="provider-card" class:active={p.name === config.activeProvider}>
						<div class="provider-info">
							<div class="provider-name">
								{p.name}
								{#if p.name === config.activeProvider}
									<span class="badge">当前使用</span>
								{/if}
							</div>
							<div class="provider-meta">
								<span>模型：{p.model}</span>
								<span>地址：{p.baseURL}</span>
								<span>密钥：{maskKey(p.apiKey)}</span>
							</div>
						</div>
						<div class="provider-actions">
							{#if p.name !== config.activeProvider}
								<button class="btn btn-sm" onclick={() => setActive(p.name)}>
									设为当前
								</button>
							{/if}
							<button class="btn btn-sm" onclick={() => editProvider(p)}>编辑</button>
							<button class="btn btn-sm btn-danger" onclick={() => removeProvider(p.name)}>
								删除
							</button>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</section>

	{#if showForm}
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div class="modal-overlay" onclick={cancelForm} onkeydown={(e: KeyboardEvent) => e.key === 'Escape' && cancelForm()} role="dialog" tabindex="-1">
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<div class="modal" onclick={(e: Event) => e.stopPropagation()} onkeydown={(e: Event) => e.stopPropagation()} role="document" tabindex="-1">
				<h3>{editingProvider ? '编辑供应商' : '添加供应商'}</h3>
				<form method="post" onsubmit={(e: Event) => { e.preventDefault(); handleSubmit(e); }}>
					<label>
						名称
						<input
							name="name"
							type="text"
							placeholder="例如：我的 OpenAI"
							value={editingProvider?.name || ''}
							required
						/>
					</label>
					<label>
						API 密钥
						<input
							name="apiKey"
							type="password"
							placeholder="sk-..."
							value={editingProvider?.apiKey || ''}
							required
						/>
					</label>
					<label>
						接口地址
						<input
							name="baseURL"
							type="text"
							placeholder="https://api.openai.com/v1"
							value={editingProvider?.baseURL || ''}
							required
						/>
					</label>
					<label>
						模型名称
						<input
							name="model"
							type="text"
							placeholder="gpt-4o"
							value={editingProvider?.model || ''}
							required
						/>
					</label>
					<div class="form-actions">
						<button type="button" class="btn" onclick={cancelForm}>取消</button>
						<button type="submit" class="btn btn-primary">
							{editingProvider ? '保存' : '添加'}
						</button>
					</div>
				</form>
			</div>
		</div>
	{/if}
</div>

<style>
	.settings {
		max-width: 720px;
		margin: 0 auto;
		padding: 2rem 1rem;
	}

	h1 {
		font-size: 1.75rem;
		margin-bottom: 2rem;
	}

	h2 {
		font-size: 1.25rem;
		margin: 0;
	}

	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}

	.section {
		margin-bottom: 2rem;
	}

	.msg {
		color: #666;
		padding: 1rem 0;
	}

	.msg-error {
		color: #d32f2f;
		background: #fdecea;
		padding: 0.75rem;
		border-radius: 6px;
		margin-bottom: 1rem;
	}

	.btn {
		padding: 0.5rem 1rem;
		border: 1px solid #ccc;
		border-radius: 6px;
		background: #fff;
		cursor: pointer;
		font-size: 0.875rem;
		transition: background 0.15s;
	}

	.btn:hover {
		background: #f0f0f0;
	}

	.btn-primary {
		background: #1976d2;
		color: #fff;
		border-color: #1976d2;
	}

	.btn-primary:hover {
		background: #1565c0;
	}

	.btn-danger {
		color: #d32f2f;
		border-color: #d32f2f;
	}

	.btn-danger:hover {
		background: #fdecea;
	}

	.btn-sm {
		padding: 0.25rem 0.75rem;
		font-size: 0.8rem;
	}

	.provider-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.provider-card {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem;
		border: 1px solid #e0e0e0;
		border-radius: 8px;
		transition: border-color 0.15s;
	}

	.provider-card.active {
		border-color: #1976d2;
		background: #f5f9ff;
	}

	.provider-name {
		font-weight: 600;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.25rem;
	}

	.badge {
		font-size: 0.7rem;
		background: #1976d2;
		color: #fff;
		padding: 0.1rem 0.5rem;
		border-radius: 4px;
		font-weight: 500;
	}

	.provider-meta {
		font-size: 0.8rem;
		color: #666;
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.provider-actions {
		display: flex;
		gap: 0.5rem;
		flex-shrink: 0;
	}

	.modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.4);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
	}

	.modal {
		background: #fff;
		border-radius: 12px;
		padding: 2rem;
		width: 100%;
		max-width: 440px;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
	}

	.modal h3 {
		margin: 0 0 1.25rem;
		font-size: 1.15rem;
	}

	form label {
		display: block;
		margin-bottom: 0.75rem;
		font-size: 0.85rem;
		color: #333;
	}

	form input {
		display: block;
		width: 100%;
		margin-top: 0.25rem;
		padding: 0.5rem 0.75rem;
		border: 1px solid #ccc;
		border-radius: 6px;
		font-size: 0.9rem;
		box-sizing: border-box;
	}

	form input:focus {
		border-color: #1976d2;
		outline: none;
		box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.2);
	}

	.form-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		margin-top: 1.5rem;
	}

	.setting-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem;
		border: 1px solid #e0e0e0;
		border-radius: 8px;
	}

	.setting-title {
		font-weight: 600;
		margin-bottom: 0.15rem;
	}

	.setting-desc {
		font-size: 0.8rem;
		color: #888;
	}

	.toggle {
		position: relative;
		width: 44px;
		height: 24px;
		border-radius: 12px;
		border: none;
		background: #ccc;
		cursor: pointer;
		transition: background 0.2s;
		flex-shrink: 0;
	}

	.toggle.on {
		background: #1976d2;
	}

	.toggle-knob {
		position: absolute;
		top: 2px;
		left: 2px;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: #fff;
		transition: transform 0.2s;
	}

	.toggle.on .toggle-knob {
		transform: translateX(20px);
	}

	.section-desc {
		font-size: 0.85rem;
		color: #888;
		margin: -0.5rem 0 0.75rem;
	}

	.prompt-editor {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid #ccc;
		border-radius: 6px;
		font-size: 0.85rem;
		font-family: inherit;
		line-height: 1.5;
		resize: vertical;
		box-sizing: border-box;
	}

	.prompt-editor:focus {
		border-color: #1976d2;
		outline: none;
		box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.2);
	}

	.prompt-actions {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-top: 0.5rem;
	}

	.prompt-hint {
		font-size: 0.8rem;
		color: #aaa;
	}
</style>
