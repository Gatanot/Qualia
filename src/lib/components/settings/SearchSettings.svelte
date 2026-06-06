<script lang="ts">
	let {
		enabled = $bindable(false),
		provider = $bindable<'searxng' | 'tavily'>('searxng'),
		searxngURL = $bindable('http://localhost:8080'),
		tavilyApiKey = $bindable(''),
		onchange
	}: {
		enabled: boolean;
		provider: 'searxng' | 'tavily';
		searxngURL: string;
		tavilyApiKey: string;
		onchange: () => void;
	} = $props();

	function handleToggle() {
		enabled = !enabled;
		onchange();
	}

	function handleProviderChange(newProvider: 'searxng' | 'tavily') {
		provider = newProvider;
		onchange();
	}
</script>

<section class="section">
	<h2>网页搜索</h2>

	<div class="setting-row">
		<div class="setting-label">
			<div class="setting-title">启用搜索</div>
			<div class="setting-desc">
				开启后 AI 可通过 web_search 工具联网搜索实时信息
			</div>
		</div>
		<button class="toggle" class:on={enabled} onclick={handleToggle} aria-label="切换搜索开关">
			<span class="toggle-knob"></span>
		</button>
	</div>

	{#if enabled}
		<div class="setting-row sub">
			<div class="setting-label">
				<div class="setting-title">搜索后端</div>
			</div>
			<div class="mode-group">
				<button class="mode-btn" class:active={provider === 'searxng'} onclick={() => handleProviderChange('searxng')}>
					SearXNG
				</button>
				<button class="mode-btn" class:active={provider === 'tavily'} onclick={() => handleProviderChange('tavily')}>
					Tavily
				</button>
			</div>
		</div>

		{#if provider === 'searxng'}
			<div class="setting-row sub">
				<div class="setting-label">
					<div class="setting-title">SearXNG 地址</div>
					<div class="setting-desc">自部署的 SearXNG 实例地址，默认 http://localhost:8080</div>
				</div>
				<div class="url-input-wrap">
					<input
						type="url"
						class="url-input"
						bind:value={searxngURL}
						placeholder="http://localhost:8080"
						oninput={() => onchange()}
					/>
				</div>
			</div>
		{:else}
			<div class="setting-row sub">
				<div class="setting-label">
					<div class="setting-title">Tavily API Key</div>
					<div class="setting-desc">从 tavily.com 获取，免费额度 1000 次/月</div>
				</div>
				<div class="url-input-wrap">
					<input
						type="password"
						class="url-input"
						bind:value={tavilyApiKey}
						placeholder="tvly-..."
						oninput={() => onchange()}
					/>
				</div>
			</div>
		{/if}
	{/if}
</section>

<style>
	.section { margin-bottom: 3rem; }

	h2 {
		font-size: var(--text-xl);
		margin: 0 0 1.25rem;
		color: var(--text-primary);
		font-weight: 500;
	}

	.setting-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.5rem;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-xl);
		background: var(--bg-surface);
		box-shadow: var(--shadow-xs);
	}

	.setting-row.sub {
		margin-top: 0.75rem;
		border-radius: var(--radius-lg);
		padding: 1.25rem 1.5rem;
	}

	.setting-title {
		font-weight: 500;
		color: var(--text-primary);
		margin-bottom: 0.4rem;
		font-size: var(--text-md);
	}

	.setting-desc {
		font-size: 0.9rem;
		color: var(--text-secondary);
		line-height: 1.5;
	}

	.toggle {
		position: relative;
		width: 52px;
		height: 28px;
		border-radius: var(--radius-pill);
		border: none;
		background: var(--border-hover);
		cursor: pointer;
		transition: background 0.3s var(--ease-in-out);
		flex-shrink: 0;
		margin-left: 1.5rem;
	}

	.toggle.on { background: var(--accent); }

	.toggle-knob {
		position: absolute;
		top: 3px;
		left: 3px;
		width: 22px;
		height: 22px;
		border-radius: var(--radius-full);
		background: var(--bg-surface);
		transition: transform 0.3s var(--ease-in-out);
		box-shadow: var(--shadow-knob);
	}

	.toggle.on .toggle-knob { transform: translateX(24px); }

	.mode-group {
		display: flex;
		border: 1px solid var(--border-strong);
		border-radius: 10px;
		overflow: hidden;
		flex-shrink: 0;
		margin-left: 1.5rem;
	}

	.mode-btn {
		padding: 0.4rem 1rem;
		border: none;
		background: transparent;
		color: var(--text-secondary);
		font-family: inherit;
		font-size: 0.9rem;
		cursor: pointer;
		transition: background 0.2s var(--ease-out), color 0.2s var(--ease-out);
	}

	.mode-btn:first-child { border-right: 1px solid var(--border-strong); }

	.mode-btn.active {
		background: var(--accent);
		color: var(--bg-page);
	}

	.url-input-wrap {
		flex-shrink: 0;
		margin-left: 1.5rem;
	}

	.url-input {
		width: 280px;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--border-strong);
		border-radius: 10px;
		background: var(--bg-page);
		color: var(--text-primary);
		font-size: var(--text-base);
		font-family: var(--font-mono);
		outline: none;
		transition: border-color 0.2s var(--ease-out);
	}

	.url-input:focus { border-color: var(--accent); }

	.url-input::placeholder { color: var(--text-placeholder); font-family: inherit; }
</style>
