<script lang="ts">
	import type { AppConfig, ProviderConfig } from '$lib/config';
	import { getDefaultModels } from '$lib/provider';
	import { DEFAULT_SYSTEM_PROMPT } from '$lib/agent/prompts';

	let config: AppConfig = $state({ providers: [], activeProvider: '', storageEnabled: false, systemPrompt: '' });
	let loading = $state(true);
	let error = $state('');
	let editingProvider: ProviderConfig | null = $state(null);
	let showForm = $state(false);
	let formType = $state<string>('openai');
	let formModel = $state('');

	$effect(() => {
		loadConfig();
	});

	let formModels = $derived(getDefaultModels(formType));

	$effect(() => {
		if (formModels.length > 0 && !formModels.find(m => m.id === formModel)) {
			formModel = formModels[0].id;
		}
	});

	function displayModel(p: ProviderConfig): string {
		if (p.models && p.activeModel) {
			const m = p.models.find(m => m.id === p.activeModel);
			return m?.name || p.activeModel;
		}
		return p.activeModel || p.model || '-';
	}

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

		const type = (fd.get('type') as string) || 'openai';
		const name = (fd.get('name') as string).trim();
		const apiKey = (fd.get('apiKey') as string).trim();
		const baseURL = (fd.get('baseURL') as string).trim();
		const activeModel = formModel;

		if (!name || !apiKey || !baseURL) {
			error = '名称、密钥、接口地址必填';
			return;
		}

		const provider: Record<string, unknown> = {
			type,
			name,
			apiKey,
			baseURL,
			activeModel,
			models: getDefaultModels(type)
		};

		if (type === 'deepseek') {
			provider.thinking = (fd.get('thinking') as string) || 'enabled';
			provider.reasoningEffort = fd.get('reasoningEffort') as string || undefined;
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

	function resetSystemPrompt() {
		config = { ...config, systemPrompt: DEFAULT_SYSTEM_PROMPT };
	}

	function editProvider(p: ProviderConfig) {
		editingProvider = p;
		formType = p.type || 'openai';
		formModel = p.activeModel || p.model || '';
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
			<div class="prompt-actions-right">
				<button type="button" class="btn" onclick={resetSystemPrompt}
					disabled={config.systemPrompt === DEFAULT_SYSTEM_PROMPT}
				>
					恢复默认
				</button>
				<button class="btn btn-primary" onclick={saveSystemPrompt}>保存提示词</button>
			</div>
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
								<span>类型：{p.type === 'deepseek' ? 'DeepSeek' : 'OpenAI 兼容'}</span>
								<span>模型：{displayModel(p)}</span>
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
						供应商类型
						<select name="type" bind:value={formType}>
							<option value="openai">OpenAI 兼容</option>
							<option value="deepseek">DeepSeek</option>
						</select>
					</label>
					<label>
						名称
						<input
							name="name"
							type="text"
							placeholder="例如：我的 DeepSeek"
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
							placeholder={formType === 'deepseek' ? 'https://api.deepseek.com/v1' : 'https://api.openai.com/v1'}
							value={editingProvider?.baseURL || ''}
							required
						/>
					</label>
					<label>
						模型
						<select name="model" bind:value={formModel}>
							{#each formModels as m}
								<option value={m.id}>{m.name}</option>
							{/each}
						</select>
					</label>

					{#if formType === 'deepseek'}
						<label>
							思考模式
							<select name="thinking">
								<option value="enabled" selected={editingProvider?.thinking !== 'disabled'}>开启</option>
								<option value="disabled" selected={editingProvider?.thinking === 'disabled'}>关闭</option>
							</select>
						</label>
						<label>
							推理深度
							<select name="reasoningEffort">
								<option value="">默认</option>
								<option value="high" selected={editingProvider?.reasoningEffort === 'high'}>high</option>
								<option value="max" selected={editingProvider?.reasoningEffort === 'max'}>max</option>
							</select>
						</label>
					{/if}

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
		max-width: 760px;
		margin: 0 auto;
		padding: 2.5rem 2rem;
		height: 100%;
		overflow-y: auto;
	}

	h1 {
		font-size: 2rem;
		margin-bottom: 2.5rem;
		color: #3D3834;
		font-weight: 500;
		letter-spacing: -0.02em;
	}

	h2 {
		font-size: 1.25rem;
		margin: 0;
		color: #3D3834;
		font-weight: 500;
	}

	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.25rem;
	}

	.section {
		margin-bottom: 3rem;
	}

	.msg {
		color: #706862;
		padding: 1rem 0;
	}

	.msg-error {
		color: #B71C1C;
		background: #FCE8E6;
		padding: 1rem 1.25rem;
		border-radius: 12px;
		margin-bottom: 1rem;
		font-size: 0.95rem;
	}

	.btn {
		padding: 0.5rem 1.25rem;
		border: 1px solid rgba(230, 226, 216, 0.8);
		border-radius: 100px;
		background: #FFFFFF;
		color: #3D3834;
		cursor: pointer;
		font-size: 0.9rem;
		font-weight: 500;
		transition: transform 0.15s, background-color 0.2s, border-color 0.2s;
	}

	.btn:hover {
		background: #F0EBE1;
		border-color: #E6E2D8;
	}
	
	.btn:active {
		transform: scale(0.98);
	}

	.btn-primary {
		background: #5E7163;
		color: #FFFFFF;
		border-color: #5E7163;
		box-shadow: 0 2px 4px rgba(94, 113, 99, 0.2);
	}

	.btn-primary:hover {
		background: #4A594E;
		border-color: #4A594E;
		box-shadow: 0 4px 8px rgba(94, 113, 99, 0.3);
	}

	.btn-danger {
		color: #D32F2F;
		border-color: rgba(211, 47, 47, 0.2);
		background: #FFFFFF;
	}

	.btn-danger:hover {
		background: #FCE8E6;
		border-color: rgba(211, 47, 47, 0.3);
	}

	.btn-sm {
		padding: 0.4rem 1rem;
		font-size: 0.85rem;
	}

	.provider-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.provider-card {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.5rem;
		border: 1px solid rgba(230, 226, 216, 0.6);
		border-radius: 20px;
		background: #FFFFFF;
		transition: all 0.2s ease;
		box-shadow: 0 2px 8px rgba(61, 56, 52, 0.02);
	}

	.provider-card.active {
		border-color: #5E7163;
		background: #F8FAF8;
		box-shadow: 0 4px 16px rgba(94, 113, 99, 0.08);
	}

	.provider-name {
		font-weight: 500;
		color: #3D3834;
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin-bottom: 0.5rem;
		font-size: 1.05rem;
	}

	.badge {
		font-size: 0.75rem;
		background: #5E7163;
		color: #FFFFFF;
		padding: 0.2rem 0.75rem;
		border-radius: 100px;
		font-weight: 500;
	}

	.provider-meta {
		font-size: 0.9rem;
		color: #706862;
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
	}

	.provider-actions {
		display: flex;
		gap: 0.5rem;
		flex-shrink: 0;
	}

	.modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(61, 56, 52, 0.4);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
	}

	.modal {
		background: #FFFFFF;
		border-radius: 28px;
		padding: 2.5rem;
		width: 100%;
		max-width: 480px;
		box-shadow: 0 12px 48px rgba(61, 56, 52, 0.15);
		animation: modalScale 0.2s cubic-bezier(0.2, 0, 0, 1) forwards;
	}
	
	@keyframes modalScale {
		from { opacity: 0; transform: scale(0.95) translateY(10px); }
		to { opacity: 1; transform: scale(1) translateY(0); }
	}

	.modal h3 {
		margin: 0 0 1.75rem;
		font-size: 1.5rem;
		font-weight: 500;
		color: #3D3834;
	}

	form label {
		display: block;
		margin-bottom: 1.25rem;
		font-size: 0.95rem;
		color: #706862;
		font-weight: 500;
	}

	form input, form select {
		display: block;
		width: 100%;
		margin-top: 0.5rem;
		padding: 0.85rem 1rem;
		border: 1px solid rgba(230, 226, 216, 0.8);
		border-radius: 12px;
		background: #FAF8F5;
		font-size: 1rem;
		color: #3D3834;
		box-sizing: border-box;
		transition: all 0.2s;
		font-family: inherit;
	}

	form input:focus, form select:focus {
		border-color: #5E7163;
		outline: none;
		background: #FFFFFF;
		box-shadow: 0 0 0 3px rgba(94, 113, 99, 0.15);
	}

	.form-actions {
		display: flex;
		justify-content: flex-end;
		gap: 1rem;
		margin-top: 2.5rem;
	}

	.setting-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.5rem;
		border: 1px solid rgba(230, 226, 216, 0.6);
		border-radius: 20px;
		background: #FFFFFF;
		box-shadow: 0 2px 8px rgba(61, 56, 52, 0.02);
	}

	.setting-title {
		font-weight: 500;
		color: #3D3834;
		margin-bottom: 0.4rem;
		font-size: 1.05rem;
	}

	.setting-desc {
		font-size: 0.9rem;
		color: #706862;
		line-height: 1.5;
	}

	.toggle {
		position: relative;
		width: 52px;
		height: 28px;
		border-radius: 100px;
		border: none;
		background: #D6CFC7;
		cursor: pointer;
		transition: background 0.3s;
		flex-shrink: 0;
	}

	.toggle.on {
		background: #5E7163;
	}

	.toggle-knob {
		position: absolute;
		top: 3px;
		left: 3px;
		width: 22px;
		height: 22px;
		border-radius: 50%;
		background: #FFFFFF;
		transition: transform 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.toggle.on .toggle-knob {
		transform: translateX(24px);
	}

	.section-desc {
		font-size: 0.95rem;
		color: #706862;
		margin: -0.25rem 0 1.25rem;
		line-height: 1.6;
	}

	.prompt-editor {
		width: 100%;
		padding: 1.25rem;
		border: 1px solid rgba(230, 226, 216, 0.8);
		border-radius: 20px;
		background: #FAF8F5;
		font-size: 0.9rem;
		font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace;
		line-height: 1.7;
		color: #3D3834;
		resize: vertical;
		box-sizing: border-box;
		transition: all 0.2s;
		min-height: 240px;
	}

	.prompt-editor:focus {
		border-color: #5E7163;
		outline: none;
		background: #FFFFFF;
		box-shadow: 0 0 0 3px rgba(94, 113, 99, 0.15);
	}

	.prompt-actions {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-top: 1rem;
	}

	.prompt-hint {
		font-size: 0.9rem;
		color: #A39B93;
	}

	.prompt-actions-right {
		display: flex;
		gap: 0.75rem;
	}
</style>
