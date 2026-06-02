<script lang="ts">
	let {
		enabled = $bindable(false),
		mode = $bindable<'idle' | 'scheduled'>('idle'),
		idleHours = $bindable(8),
		scheduleHour = $bindable(2),
		intervalMin = $bindable(30),
		onchange
	}: {
		enabled: boolean;
		mode: 'idle' | 'scheduled';
		idleHours: number;
		scheduleHour: number;
		intervalMin: number;
		onchange: () => void;
	} = $props();

	let generating = $state(false);
	let resultMsg = $state('');

	function handleToggle() {
		enabled = !enabled;
		onchange();
	}

	function handleModeChange(newMode: 'idle' | 'scheduled') {
		mode = newMode;
		onchange();
	}

	function handleIdleChange(e: Event) {
		const v = parseInt((e.target as HTMLInputElement).value);
		if (v >= 1 && v <= 48) {
			idleHours = v;
			onchange();
		}
	}

	function handleScheduleChange(e: Event) {
		const v = parseInt((e.target as HTMLInputElement).value);
		if (v >= 0 && v <= 23) {
			scheduleHour = v;
			onchange();
		}
	}

	function handleIntervalChange(e: Event) {
		const v = parseInt((e.target as HTMLInputElement).value);
		if (v >= 5 && v <= 120) {
			intervalMin = v;
			onchange();
		}
	}

	async function handleGenerate() {
		if (generating) return;
		generating = true;
		resultMsg = '';
		try {
			const res = await fetch('/api/summarize', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ force: true })
			});
			if (res.ok) {
				const data = await res.json();
				resultMsg = `已为 ${data.summarized} 个会话生成摘要` + (data.diary ? '，并撰写日记' : '');
			} else {
				const err = await res.json();
				resultMsg = err.error || '生成失败';
			}
		} catch {
			resultMsg = '请求失败';
		} finally {
			generating = false;
		}
	}
</script>

<section class="section">
	<h2>摘要与日记</h2>
	<div class="setting-row">
		<div class="setting-label">
			<div class="setting-title">自动生成</div>
			<div class="setting-desc">
				{#if enabled}
					{#if mode === 'idle'}
						会话空闲 {idleHours} 小时后自动生成摘要
					{:else}
						每天 {scheduleHour}:00 自动生成摘要和日记
					{/if}
				{:else}
					已关闭
				{/if}
			</div>
		</div>
		<button
			class="toggle"
			class:on={enabled}
			onclick={handleToggle}
			aria-label="切换自动摘要开关"
		>
			<span class="toggle-knob"></span>
		</button>
	</div>

	{#if enabled}
		<div class="setting-row sub">
			<div class="setting-label">
				<div class="setting-title">生成模式</div>
			</div>
			<div class="mode-group">
				<button
					class="mode-btn"
					class:active={mode === 'idle'}
					onclick={() => handleModeChange('idle')}
				>空闲触发</button>
				<button
					class="mode-btn"
					class:active={mode === 'scheduled'}
					onclick={() => handleModeChange('scheduled')}
				>定时</button>
			</div>
		</div>

		{#if mode === 'idle'}
			<div class="setting-row sub">
				<div class="setting-label">
					<div class="setting-title">空闲阈值</div>
					<div class="setting-desc">
						会话超过此时间未活动时生成摘要
					</div>
				</div>
				<div class="number-input">
					<input
						type="number"
						min="1"
						max="48"
						value={idleHours}
						oninput={handleIdleChange}
					/>
					<span class="number-unit">小时</span>
				</div>
			</div>
		{:else}
			<div class="setting-row sub">
				<div class="setting-label">
					<div class="setting-title">执行时刻</div>
					<div class="setting-desc">
						每天此时自动为所有会话生成摘要和日记
					</div>
				</div>
				<div class="number-input">
					<input
						type="number"
						min="0"
						max="23"
						value={scheduleHour}
						oninput={handleScheduleChange}
					/>
					<span class="number-unit">时</span>
				</div>
			</div>
		{/if}

		<div class="setting-row sub">
			<div class="setting-label">
				<div class="setting-title">扫描间隔</div>
				<div class="setting-desc">
					后台检查触发条件的频率
				</div>
			</div>
			<div class="number-input">
				<input
					type="number"
					min="5"
					max="120"
					value={intervalMin}
					oninput={handleIntervalChange}
				/>
				<span class="number-unit">分钟</span>
			</div>
		</div>

		<div class="setting-row sub action-row">
			<div class="setting-label">
				<div class="setting-title">立即生成</div>
				<div class="setting-desc">
					{#if resultMsg}
						{resultMsg}
					{:else}
						立即为所有有消息的会话生成摘要和日记
					{/if}
				</div>
			</div>
			<button class="generate-btn" onclick={handleGenerate} disabled={generating}>
				{#if generating}
					<span class="spinner"></span>
					生成中
				{:else}
					执行
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

	.toggle.on {
		background: var(--accent);
	}

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

	.toggle.on .toggle-knob {
		transform: translateX(24px);
	}

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

	.mode-btn:first-child {
		border-right: 1px solid var(--border-strong);
	}

	.mode-btn.active {
		background: var(--accent);
		color: var(--bg-page);
	}

	.number-input {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-shrink: 0;
		margin-left: 1.5rem;
	}

	.number-input input {
		width: 64px;
		padding: 0.4rem 0.6rem;
		border: 1px solid var(--border-strong);
		border-radius: 10px;
		background: var(--bg-page);
		color: var(--text-primary);
		font-size: var(--text-base);
		font-family: inherit;
		text-align: center;
		outline: none;
		transition: border-color 0.2s var(--ease-out);
	}

	.number-input input:focus {
		border-color: var(--accent);
	}

	.number-unit {
		font-size: 0.9rem;
		color: var(--text-secondary);
	}

	.action-row {
		align-items: center;
	}

	.generate-btn {
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
		transition: background 0.2s var(--ease-out), color 0.2s var(--ease-out), transform 0.15s var(--ease-out);
	}

	.generate-btn:hover:not(:disabled) {
		background: var(--accent);
		color: var(--bg-page);
		transform: translateY(-1px);
	}

	.generate-btn:active:not(:disabled) {
		transform: translateY(0) scale(0.97);
	}

	.generate-btn:disabled {
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
