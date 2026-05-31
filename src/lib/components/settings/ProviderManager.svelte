<script lang="ts">
	import type { ProviderConfig } from '$lib/config';
	import { getDefaultModels } from '$lib/provider';

	let { providers, activeProvider, loading, onconfigchange }: {
		providers: ProviderConfig[];
		activeProvider: string;
		loading: boolean;
		onconfigchange: (config: Record<string, unknown>) => void;
	} = $props();

	let error = $state('');
	let showForm = $state(false);
	let editingProvider = $state<ProviderConfig | null>(null);
	let formType = $state<string>('openai');
	let formModel = $state('');

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

	function maskKey(key: string): string {
		if (key.length <= 8) return '****';
		return key.slice(0, 4) + '****' + key.slice(-4);
	}

	function openAdd() {
		editingProvider = null;
		formType = 'openai';
		formModel = getDefaultModels('openai')[0]?.id || '';
		showForm = true;
		error = '';
	}

	function openEdit(p: ProviderConfig) {
		editingProvider = p;
		formType = p.type || 'openai';
		formModel = p.activeModel || p.model || '';
		showForm = true;
		error = '';
	}

	function cancelForm() {
		showForm = false;
		editingProvider = null;
		error = '';
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
			const config = await res.json();
			onconfigchange(config);
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
			onconfigchange(await res.json());
		}
	}

	async function setActive(name: string) {
		const res = await fetch('/api/config', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'setActiveProvider', name })
		});
		if (res.ok) {
			onconfigchange(await res.json());
		}
	}
</script>

<section class="section">
	<div class="section-header">
		<h2>AI 供应商</h2>
		<button class="btn btn-primary" onclick={openAdd}>
			+ 添加供应商
		</button>
	</div>

	{#if error}
		<div class="msg msg-error">{error}</div>
	{/if}

	{#if loading}
		<p class="msg">加载中...</p>
	{:else if providers.length === 0}
		<p class="msg">尚未配置供应商，请添加一个开始使用</p>
	{:else}
		<div class="provider-list">
			{#each providers as p (p.name)}
				<div class="provider-card" class:active={p.name === activeProvider}>
					<div class="provider-info">
						<div class="provider-name">
							{p.name}
							{#if p.name === activeProvider}
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
						{#if p.name !== activeProvider}
							<button class="btn btn-sm" onclick={() => setActive(p.name)}>
								设为当前
							</button>
						{/if}
						<button class="btn btn-sm" onclick={() => openEdit(p)}>编辑</button>
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

<style>
	.section { margin-bottom: 3rem; }

	h2 {
		font-size: 1.25rem;
		margin: 0;
		color: var(--text-primary);
		font-weight: 500;
	}

	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.25rem;
	}

	.msg {
		color: var(--text-secondary);
		padding: 1rem 0;
	}

	.msg-error {
		color: var(--danger-text);
		background: var(--danger-bg);
		padding: 1rem 1.25rem;
		border-radius: 12px;
		margin-bottom: 1rem;
		font-size: 0.95rem;
	}

	.btn {
		padding: 0.5rem 1.25rem;
		border: 1px solid var(--border-accent);
		border-radius: 100px;
		background: var(--bg-surface);
		color: var(--text-primary);
		cursor: pointer;
		font-size: 0.9rem;
		font-weight: 500;
		font-family: inherit;
		transition: transform 0.15s, background-color 0.2s, border-color 0.2s, box-shadow 0.2s;
	}

	.btn:hover {
		background: var(--bg-surface-hover);
		border-color: var(--border-hover);
	}

	.btn:active {
		transform: scale(0.98);
	}

	.btn-primary {
		background: var(--accent);
		color: var(--text-on-accent);
		border-color: var(--accent);
		box-shadow: 0 4px 12px rgba(123, 140, 124, 0.15);
	}

	.btn-primary:hover {
		background: var(--accent-hover);
		border-color: var(--accent-hover);
		box-shadow: 0 6px 16px rgba(123, 140, 124, 0.25);
	}

	.btn-danger {
		color: var(--danger-btn);
		border-color: rgba(211, 47, 47, 0.2);
		background: var(--bg-surface);
	}

	.btn-danger:hover {
		background: var(--danger-btn-hover-bg);
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
		border: 1px solid var(--border);
		border-radius: 24px;
		background: var(--bg-surface);
		transition: all 0.25s ease;
		box-shadow: var(--shadow-sm);
	}

	.provider-card.active {
		border-color: var(--accent);
		background: var(--bg-surface-alt);
		box-shadow: var(--shadow-focus);
	}

	.provider-name {
		font-weight: 500;
		color: var(--text-primary);
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin-bottom: 0.5rem;
		font-size: 1.05rem;
	}

	.badge {
		font-size: 0.75rem;
		background: var(--accent);
		color: var(--text-on-accent);
		padding: 0.25rem 0.8rem;
		border-radius: 100px;
		font-weight: 500;
	}

	.provider-meta {
		font-size: 0.9rem;
		color: var(--text-secondary);
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
		background: var(--overlay-heavy);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
	}

	.modal {
		background: var(--bg-surface);
		border-radius: 28px;
		padding: 2.5rem;
		width: 100%;
		max-width: 480px;
		max-height: 90vh;
		overflow-y: auto;
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
		color: var(--text-primary);
	}

	form label {
		display: block;
		margin-bottom: 1.25rem;
		font-size: 0.95rem;
		color: var(--text-secondary);
		font-weight: 500;
	}

	form input, form select {
		display: block;
		width: 100%;
		margin-top: 0.5rem;
		padding: 0.85rem 1rem;
		border: 1px solid var(--border-accent);
		border-radius: 12px;
		background: var(--bg-input);
		font-size: 1rem;
		color: var(--text-primary);
		box-sizing: border-box;
		transition: all 0.2s;
		font-family: inherit;
	}

	form input:focus, form select:focus {
		border-color: var(--accent);
		outline: none;
		background: var(--bg-surface);
		box-shadow: var(--shadow-focus);
	}

	.form-actions {
		display: flex;
		justify-content: flex-end;
		gap: 1rem;
		margin-top: 2.5rem;
	}
</style>
