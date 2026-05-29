<script lang="ts">
	import type { AppConfig, ProviderConfig } from '$lib/config';

	let config: AppConfig = $state({ providers: [], activeProvider: '', storageEnabled: false, systemPrompt: '' });
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
		<p class="section-desc">定义 Qualia 的角色和行为准则，将作为每条对话的 system prompt 发送给模型。</p>
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
		padding: 2rem 1.5rem;
	}

	h1 {
		font-size: 1.75rem;
		margin-bottom: 2rem;
		color: #4A433E;
		font-weight: 500;
	}

	h2 {
		font-size: 1.25rem;
		margin: 0;
		color: #4A433E;
		font-weight: 500;
	}

	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}

	.section {
		margin-bottom: 2.5rem;
	}

	.msg {
		color: #8C847D;
		padding: 1rem 0;
	}

	.msg-error {
		color: #D32F2F;
		background: #FDECEA;
		padding: 0.75rem 1rem;
		border-radius: 12px;
		margin-bottom: 1rem;
		font-size: 0.9rem;
	}

	.btn {
		padding: 0.5rem 1.25rem;
		border: 1px solid #EAE4DC;
		border-radius: 100px;
		background: #fff;
		color: #4A433E;
		cursor: pointer;
		font-size: 0.875rem;
		font-weight: 500;
		transition: all 0.2s;
	}

	.btn:hover {
		background: #F4EFE6;
	}

	.btn-primary {
		background: #6B7F72;
		color: #fff;
		border-color: #6B7F72;
	}

	.btn-primary:hover {
		background: #5A6B60;
	}

	.btn-danger {
		color: #D32F2F;
		border-color: #FDECEA;
		background: #fff;
	}

	.btn-danger:hover {
		background: #FDECEA;
		border-color: #FDECEA;
	}

	.btn-sm {
		padding: 0.35rem 0.85rem;
		font-size: 0.8rem;
	}

	.provider-list {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.provider-card {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.25rem;
		border: 1px solid #EAE4DC;
		border-radius: 16px;
		background: #fff;
		transition: all 0.2s;
		box-shadow: 0 2px 8px rgba(74, 67, 62, 0.02);
	}

	.provider-card.active {
		border-color: #6B7F72;
		background: #F8FAF8;
		box-shadow: 0 4px 12px rgba(107, 127, 114, 0.08);
	}

	.provider-name {
		font-weight: 500;
		color: #4A433E;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.4rem;
	}

	.badge {
		font-size: 0.7rem;
		background: #6B7F72;
		color: #fff;
		padding: 0.15rem 0.6rem;
		border-radius: 100px;
		font-weight: 500;
	}

	.provider-meta {
		font-size: 0.85rem;
		color: #8C847D;
		display: flex;
		flex-wrap: wrap;
		gap: 0.85rem;
	}

	.provider-actions {
		display: flex;
		gap: 0.5rem;
		flex-shrink: 0;
	}

	.modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(74, 67, 62, 0.4);
		backdrop-filter: blur(2px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
	}

	.modal {
		background: #fff;
		border-radius: 28px;
		padding: 2.5rem;
		width: 100%;
		max-width: 440px;
		box-shadow: 0 12px 40px rgba(74, 67, 62, 0.15);
	}

	.modal h3 {
		margin: 0 0 1.5rem;
		font-size: 1.25rem;
		font-weight: 500;
		color: #4A433E;
	}

	form label {
		display: block;
		margin-bottom: 1rem;
		font-size: 0.9rem;
		color: #6D645D;
		font-weight: 500;
	}

	form input {
		display: block;
		width: 100%;
		margin-top: 0.4rem;
		padding: 0.75rem 1rem;
		border: 1px solid #EAE4DC;
		border-radius: 12px;
		background: #FDFBF7;
		font-size: 0.95rem;
		color: #4A433E;
		box-sizing: border-box;
		transition: all 0.2s;
	}

	form input:focus {
		border-color: #6B7F72;
		outline: none;
		background: #fff;
		box-shadow: 0 0 0 3px rgba(107, 127, 114, 0.15);
	}

	.form-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		margin-top: 2rem;
	}

	.setting-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.25rem;
		border: 1px solid #EAE4DC;
		border-radius: 16px;
		background: #fff;
		box-shadow: 0 2px 8px rgba(74, 67, 62, 0.02);
	}

	.setting-title {
		font-weight: 500;
		color: #4A433E;
		margin-bottom: 0.25rem;
	}

	.setting-desc {
		font-size: 0.85rem;
		color: #8C847D;
		line-height: 1.4;
	}

	.toggle {
		position: relative;
		width: 48px;
		height: 26px;
		border-radius: 100px;
		border: none;
		background: #D6CFC7;
		cursor: pointer;
		transition: background 0.3s;
		flex-shrink: 0;
	}

	.toggle.on {
		background: #6B7F72;
	}

	.toggle-knob {
		position: absolute;
		top: 3px;
		left: 3px;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: #fff;
		transition: transform 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.toggle.on .toggle-knob {
		transform: translateX(22px);
	}

	.section-desc {
		font-size: 0.9rem;
		color: #8C847D;
		margin: -0.25rem 0 1rem;
		line-height: 1.5;
	}

	.prompt-editor {
		width: 100%;
		padding: 1rem;
		border: 1px solid #EAE4DC;
		border-radius: 16px;
		background: #FDFBF7;
		font-size: 0.95rem;
		font-family: inherit;
		line-height: 1.6;
		color: #4A433E;
		resize: vertical;
		box-sizing: border-box;
		transition: all 0.2s;
	}

	.prompt-editor:focus {
		border-color: #6B7F72;
		outline: none;
		background: #fff;
		box-shadow: 0 0 0 3px rgba(107, 127, 114, 0.15);
	}

	.prompt-actions {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-top: 0.75rem;
	}

	.prompt-hint {
		font-size: 0.85rem;
		color: #A3A8A0;
	}
</style>
