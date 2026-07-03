<script lang="ts">
	let {
		enabled = $bindable(false),
		botToken = $bindable(''),
		allowedUsers = $bindable(''),
		onchange
	}: {
		enabled: boolean;
		botToken: string;
		allowedUsers: string;
		onchange: () => void;
	} = $props();

	function handleToggle() {
		enabled = !enabled;
		onchange();
	}

	function handleChange() {
		onchange();
	}
</script>

<section class="section">
	<h2>Telegram</h2>

	<div class="setting-row">
		<div class="setting-label">
			<div class="setting-title">启用 Telegram 接入</div>
			<div class="setting-desc">
				{#if enabled}
					通过 Telegram Bot 接收消息和发送通知
				{:else}
					已关闭
				{/if}
			</div>
		</div>
		<button
			class="toggle"
			class:on={enabled}
			onclick={handleToggle}
			aria-label="切换 Telegram 开关"
		>
			<span class="toggle-knob"></span>
		</button>
	</div>

	{#if enabled}
		<div class="setting-row sub">
			<div class="setting-label">
				<div class="setting-title">Bot Token</div>
				<div class="setting-desc">
					在 <a href="https://t.me/BotFather" target="_blank" rel="noopener">@BotFather</a> 创建 Bot 后获取
				</div>
			</div>
			<div class="input-wrapper">
				<input
					type="password"
					bind:value={botToken}
					placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
					oninput={handleChange}
				/>
			</div>
		</div>

		{#if botToken}
			<div class="setting-row sub">
				<div class="setting-label">
					<div class="setting-title">允许的用户</div>
					<div class="setting-desc">
						逗号分隔的 chat ID 列表。获取方式：给 Bot 发一条消息，然后访问 <code>https://api.telegram.org/bot&lt;token&gt;/getUpdates</code>
					</div>
				</div>
				<div class="input-wrapper">
					<input
						type="text"
						bind:value={allowedUsers}
						placeholder="12345678,87654321"
						oninput={handleChange}
					/>
				</div>
			</div>
		{/if}

		<div class="setting-row sub">
			<div class="setting-label">
				<div class="setting-title">连接状态</div>
				<div class="setting-desc">
					保存配置后重启服务即可连接
				</div>
			</div>
			<span class="hint">需重启服务生效</span>
		</div>
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

	.setting-desc a {
		color: var(--accent);
		text-decoration: none;
	}

	.setting-desc code {
		font-size: 0.8rem;
		background: var(--bg-page);
		padding: 0.1rem 0.3rem;
		border-radius: 4px;
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

	.input-wrapper {
		flex-shrink: 0;
		margin-left: 1.5rem;
	}

	.input-wrapper input {
		width: 280px;
		padding: 0.4rem 0.6rem;
		border: 1px solid var(--border-strong);
		border-radius: 10px;
		background: var(--bg-page);
		color: var(--text-primary);
		font-size: var(--text-base);
		font-family: inherit;
		outline: none;
		transition: border-color 0.2s var(--ease-out);
	}

	.input-wrapper input:focus { border-color: var(--accent); }

	.hint {
		font-size: 0.8rem;
		color: var(--text-tertiary);
		margin-left: 1.5rem;
	}
</style>
