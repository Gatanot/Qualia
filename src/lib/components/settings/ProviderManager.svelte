<script lang="ts">
	import type { ProviderConfig } from '$lib/config';
	import { getDefaultModels } from '$lib/provider';

	let { providers, loading, onconfigchange }: {
		providers: ProviderConfig[];
		loading: boolean;
		onconfigchange: (config: Record<string, unknown>) => void;
	} = $props();

	let error = $state('');
	let showForm = $state(false);
	let editingProvider = $state<ProviderConfig | null>(null);
	let formType = $state<string>('openai');
	let formReasoningEffort = $state('');

	let formModels = $derived(getDefaultModels(formType));
	let reasoningOptions = $derived.by(() => {
		if (formModels.length === 0 || !formModels[0].supportsReasoning) return [];
		const values = formModels[0].reasoningEffortValues;
		if (values.length > 0) return values;
		return ['enabled'];
	});

	function maskKey(key: string): string {
		if (key.length <= 8) return '****';
		return key.slice(0, 4) + '****' + key.slice(-4);
	}

	function openAdd() {
		editingProvider = null;
		formType = 'openai';
		formReasoningEffort = '';
		showForm = true;
		error = '';
	}

	function openEdit(p: ProviderConfig) {
		editingProvider = p;
		formType = p.type || 'openai';
		formReasoningEffort = p.reasoningEffort || '';
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

		if (!name || !apiKey || !baseURL) {
			error = '名称、密钥、接口地址必填';
			return;
		}

		const provider: Record<string, unknown> = {
			type,
			name,
			apiKey,
			baseURL
		};

		if (formReasoningEffort) {
			provider.reasoningEffort = formReasoningEffort;
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
				<div class="provider-card">
					<div class="provider-info">
						<div class="provider-name">
							{p.name}
						</div>
						<div class="provider-meta">
							<span>类型：{p.type === 'deepseek' ? 'DeepSeek' : p.type === 'xiaomi' ? 'Xiaomi MiMo' : 'OpenAI 兼容'}</span>
							<span>密钥：{maskKey(p.apiKey)}</span>
						</div>
					</div>
					<div class="provider-actions">
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
						<option value="xiaomi">Xiaomi MiMo</option>
					</select>
				</label>
				<label>
					名称
					<input
						name="name"
						type="text"
						placeholder="例如：我的 MiMo"
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
						placeholder={formType === 'deepseek' ? 'https://api.deepseek.com/v1' : formType === 'xiaomi' ? 'https://api.xiaomimimo.com/v1' : 'https://api.openai.com/v1'}
						value={editingProvider?.baseURL || ''}
						required
					/>
				</label>

				{#if reasoningOptions.length > 0}
					<label>
						推理深度
						<select name="reasoningEffort" bind:value={formReasoningEffort}>
							<option value="">不开启</option>
							{#each reasoningOptions as v}
								<option value={v}>{v === 'enabled' ? '开启' : v}</option>
							{/each}
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
		font-size: var(--text-xl);
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
		border-radius: var(--radius-md);
		margin-bottom: 1rem;
		font-size: var(--text-base);
	}

	.btn {
		padding: 0.5rem 1.25rem;
		border: 1px solid var(--border-accent);
		border-radius: var(--radius-pill);
		background: var(--bg-surface);
		color: var(--text-primary);
		cursor: pointer;
		font-size: 0.9rem;
		font-weight: 500;
		font-family: inherit;
		transition: transform 0.15s var(--ease-out), background-color 0.2s var(--ease-out), border-color 0.2s var(--ease-out), box-shadow 0.2s var(--ease-out);
	}

	.btn:hover {
		background: var(--bg-surface-hover);
		border-color: var(--border-hover);
	}

	.btn:active {
		transform: scale(0.97);
	}

	.btn-primary {
		background: var(--accent);
		color: var(--text-on-accent);
		border-color: var(--accent);
		box-shadow: var(--shadow-accent-btn);
	}

	.btn-primary:hover {
		background: var(--accent-hover);
		border-color: var(--accent-hover);
		box-shadow: var(--shadow-accent-btn-hover);
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
		font-size: var(--text-sm);
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
		border-radius: var(--radius-2xl);
		background: var(--bg-surface);
		transition: all 0.25s var(--ease-out);
		box-shadow: var(--shadow-xs);
	}

	.provider-name {
		font-weight: 500;
		color: var(--text-primary);
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin-bottom: 0.5rem;
		font-size: var(--text-md);
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
		-webkit-backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
	}

	.modal {
		background: var(--bg-surface);
		border-radius: var(--radius-3xl);
		padding: 2.5rem;
		width: 100%;
		max-width: 480px;
		max-height: 90vh;
		overflow-y: auto;
		box-shadow: var(--shadow-modal);
		animation: modalScale 0.25s var(--ease-out) forwards;
	}

	@keyframes modalScale {
		from { opacity: 0; transform: scale(0.94) translateY(12px); }
		to { opacity: 1; transform: scale(1) translateY(0); }
	}

	.modal h3 {
		margin: 0 0 1.75rem;
		font-size: var(--text-2xl);
		font-weight: 500;
		color: var(--text-primary);
	}

	form label {
		display: block;
		margin-bottom: 1.25rem;
		font-size: var(--text-base);
		color: var(--text-secondary);
		font-weight: 500;
	}

	form input, form select {
		display: block;
		width: 100%;
		margin-top: 0.5rem;
		padding: 0.85rem 1rem;
		border: 1px solid var(--border-accent);
		border-radius: var(--radius-md);
		background: var(--bg-input);
		font-size: 1rem;
		color: var(--text-primary);
		box-sizing: border-box;
		transition: all 0.25s var(--ease-out);
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
