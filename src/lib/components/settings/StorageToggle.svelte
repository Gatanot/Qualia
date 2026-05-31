<script lang="ts">
	let { enabled = $bindable(false), ontoggle }: {
		enabled: boolean;
		ontoggle: () => void;
	} = $props();
</script>

<section class="section">
	<h2>常规</h2>
	<div class="setting-row">
		<div class="setting-label">
			<div class="setting-title">对话存储</div>
			<div class="setting-desc">
				{#if enabled}
					已开启 — 对话历史持久化到本地数据库
				{:else}
					已关闭 — 数据仅保存在内存，重启后丢失（适合开发测试）
				{/if}
			</div>
		</div>
		<button
			class="toggle"
			class:on={enabled}
			onclick={ontoggle}
			aria-label="切换存储开关"
		>
			<span class="toggle-knob"></span>
		</button>
	</div>
</section>

<style>
	.section { margin-bottom: 3rem; }

	h2 {
		font-size: 1.25rem;
		margin: 0;
		color: var(--text-primary);
		font-weight: 500;
	}

	.setting-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.5rem;
		border: 1px solid var(--border-strong);
		border-radius: 20px;
		background: var(--bg-surface);
		box-shadow: var(--shadow-sm);
	}

	.setting-title {
		font-weight: 500;
		color: var(--text-primary);
		margin-bottom: 0.4rem;
		font-size: 1.05rem;
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
		border-radius: 100px;
		border: none;
		background: var(--border-hover);
		cursor: pointer;
		transition: background 0.3s;
		flex-shrink: 0;
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
		border-radius: 50%;
		background: var(--bg-surface);
		transition: transform 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
		box-shadow: var(--shadow-knob);
	}

	.toggle.on .toggle-knob {
		transform: translateX(24px);
	}
</style>
