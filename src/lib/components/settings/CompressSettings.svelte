<script lang="ts">
	let { mode = $bindable('auto' as 'auto' | 'custom'), threshold = $bindable(0), onchange }: {
		mode: 'auto' | 'custom';
		threshold: number;
		onchange: () => Promise<void>;
	} = $props();
</script>

<section class="section">
	<h2>上下文压缩</h2>
	<p class="desc">当对话内容接近上下文窗口极限时，自动生成摘要并创建延续会话。</p>

	<div class="form-group">
		<fieldset class="radio-fieldset">
			<legend class="label">压缩策略</legend>
		<div class="radio-group">
			<label class="radio">
				<input type="radio" name="mode" value="auto" checked={mode === 'auto'} onchange={() => { mode = 'auto'; onchange(); }} />
				<span>使用模型默认上下文窗口</span>
			</label>
			<label class="radio">
				<input type="radio" name="mode" value="custom" checked={mode === 'custom'} onchange={() => { mode = 'custom'; onchange(); }} />
				<span>自定义阈值</span>
			</label>
		</div>
		</fieldset>
	</div>

	{#if mode === 'custom'}
		<div class="form-group">
			<label class="label" for="threshold">触发阈值（token）</label>
			<div class="input-with-hint">
				<input id="threshold" type="number" min="50000" step="10000" bind:value={threshold} onchange={onchange} />
				<span class="hint">推荐 256000 ~ 300000。对话总 token 数超过此值后自动续写新会话。</span>
			</div>
		</div>
	{/if}
</section>

<style>
	.section {
		margin-bottom: 28px;
	}
	h2 {
		font-size: 1rem;
		font-weight: 600;
		margin: 0 0 4px 0;
		color: var(--text-primary);
	}
	.desc {
		font-size: 0.85rem;
		color: var(--text-secondary);
		margin: 0 0 16px 0;
		line-height: 1.5;
	}
	.form-group {
		margin-top: 14px;
	}
	.label {
		display: block;
		font-size: 0.82rem;
		font-weight: 500;
		color: var(--text-secondary);
		margin-bottom: 6px;
	}
	.radio-group {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.radio {
		display: flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
		font-size: 0.9rem;
		color: var(--text-primary);
	}
	.radio input {
		accent-color: var(--accent);
	}
	.input-with-hint {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.input-with-hint input {
		width: 140px;
		padding: 6px 10px;
		font-size: 0.9rem;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--surface);
		color: var(--text-primary);
	}
	.hint {
		font-size: 0.78rem;
		color: var(--text-tertiary);
		line-height: 1.4;
	}
	.radio-fieldset {
		border: none;
		padding: 0;
		margin: 0;
	}
	.radio-fieldset legend {
		padding: 0;
		margin-bottom: 6px;
	}
</style>
