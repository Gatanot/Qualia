<script lang="ts">
	let {
		notifications = $bindable(false),
		smtpHost = $bindable(''),
		smtpPort = $bindable(465),
		smtpSecure = $bindable(true),
		smtpUser = $bindable(''),
		smtpPass = $bindable(''),
		emailFrom = $bindable(''),
		emailTo = $bindable(''),
		onchange
	}: {
		notifications: boolean;
		smtpHost: string;
		smtpPort: number;
		smtpSecure: boolean;
		smtpUser: string;
		smtpPass: string;
		emailFrom: string;
		emailTo: string;
		onchange: () => void;
	} = $props();

	let testing = $state(false);
	let testResult = $state('');

	function handleToggle() {
		notifications = !notifications;
		onchange();
	}

	function handleChange() {
		onchange();
	}

	async function handleTest() {
		if (testing) return;
		testing = true;
		testResult = '';
		try {
			const res = await fetch('/api/config', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'testEmail', config: { smtpHost, smtpPort, smtpSecure, user: smtpUser, password: smtpPass, from: emailFrom, to: emailTo } })
			});
			const data = await res.json();
			testResult = data.success ? '测试邮件已发送，请检查收件箱' : (data.error || '发送失败');
		} catch (e) {
			testResult = '请求失败: ' + (e as Error).message;
		} finally {
			testing = false;
		}
	}
</script>

<section class="section">
	<h2>邮件通知</h2>

	<div class="setting-row">
		<div class="setting-label">
			<div class="setting-title">启用邮件通知</div>
			<div class="setting-desc">
				{#if notifications}
					任务完成、摘要生成时通过邮件通知
				{:else}
					已关闭
				{/if}
			</div>
		</div>
		<button
			class="toggle"
			class:on={notifications}
			onclick={handleToggle}
			aria-label="切换邮件通知开关"
		>
			<span class="toggle-knob"></span>
		</button>
	</div>

	{#if notifications}
		<div class="setting-row sub">
			<div class="setting-label">
				<div class="setting-title">SMTP 服务器</div>
				<div class="setting-desc">发送邮件的服务器地址和端口</div>
			</div>
			<div class="inline-inputs">
				<input
					type="text"
					bind:value={smtpHost}
					placeholder="smtp.qq.com"
					oninput={handleChange}
				/>
				<input
					type="number"
					bind:value={smtpPort}
					min={1}
					max={65535}
					oninput={handleChange}
				/>
				<label class="checkbox-label">
					<input type="checkbox" bind:checked={smtpSecure} onchange={handleChange} />
					<span>SSL</span>
				</label>
			</div>
		</div>

		<div class="setting-row sub">
			<div class="setting-label">
				<div class="setting-title">发件账号</div>
			</div>
			<div class="inline-inputs">
				<input
					type="text"
					bind:value={smtpUser}
					placeholder="your@qq.com"
					oninput={handleChange}
				/>
				<input
					type="password"
					bind:value={smtpPass}
					placeholder="授权码"
					oninput={handleChange}
				/>
			</div>
		</div>

		<div class="setting-row sub">
			<div class="setting-label">
				<div class="setting-title">发件人与收件人</div>
			</div>
			<div class="inline-inputs">
				<input
					type="text"
					bind:value={emailFrom}
					placeholder="发件人地址"
					oninput={handleChange}
				/>
				<input
					type="text"
					bind:value={emailTo}
					placeholder="收件人地址"
					oninput={handleChange}
				/>
			</div>
		</div>

		<div class="setting-row sub action-row">
			<div class="setting-label">
				<div class="setting-title">测试发送</div>
				<div class="setting-desc">
					{#if testResult}
						{testResult}
					{:else}
						发送一封测试邮件以验证配置
					{/if}
				</div>
			</div>
			<button class="test-btn" onclick={handleTest} disabled={testing}>
				{#if testing}
					<span class="spinner"></span>
					发送中
				{:else}
					测试
				{/if}
			</button>
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

	.inline-inputs {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-shrink: 0;
		margin-left: 1.5rem;
	}

	.inline-inputs input[type="text"],
	.inline-inputs input[type="password"],
	.inline-inputs input[type="number"] {
		width: 160px;
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

	.inline-inputs input[type="number"] { width: 72px; }

	.inline-inputs input:focus { border-color: var(--accent); }

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.9rem;
		color: var(--text-secondary);
		cursor: pointer;
		white-space: nowrap;
	}

	.action-row { align-items: center; }

	.test-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1.25rem;
		border: 1px solid var(--accent);
		border-radius: 10px;
		background: transparent;
		color: var(--accent);
		font-family: inherit;
		font-size: var(--text-base);
		font-weight: 500;
		cursor: pointer;
		flex-shrink: 0;
		margin-left: 1.5rem;
		transition: background 0.2s var(--ease-out), color 0.2s var(--ease-out);
	}

	.test-btn:hover:not(:disabled) {
		background: var(--accent);
		color: var(--bg-page);
	}

	.test-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.spinner {
		width: 14px;
		height: 14px;
		border: 2px solid var(--border-hover);
		border-top-color: var(--accent);
		border-radius: var(--radius-full);
		animation: spin 0.6s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}
</style>
