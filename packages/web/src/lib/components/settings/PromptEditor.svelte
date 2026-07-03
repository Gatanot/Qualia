<script lang="ts">
	import { DEFAULT_SYSTEM_PROMPT } from '@gatanot/qualia_core/agent/prompts';

	let { systemPrompt = $bindable(''), onsave }: {
		systemPrompt: string;
		onsave: () => void;
	} = $props();

	function reset() {
		systemPrompt = DEFAULT_SYSTEM_PROMPT;
	}
</script>

<section class="section">
	<h2>系统提示词</h2>
	<p class="section-desc">定义 Qualia 的角色和行为准则，将作为每条对话的 system prompt 发送给模型。</p>
	<textarea
		class="prompt-editor"
		bind:value={systemPrompt}
		rows={10}
		placeholder="输入系统提示词..."
	></textarea>
	<div class="prompt-actions">
		<span class="prompt-hint">{systemPrompt?.length || 0} 字符</span>
		<div class="prompt-actions-right">
			<button type="button" class="btn" onclick={reset}
				disabled={systemPrompt === DEFAULT_SYSTEM_PROMPT}
			>
				恢复默认
			</button>
			<button class="btn btn-primary" onclick={onsave}>保存提示词</button>
		</div>
	</div>
</section>

<style>
	.section { margin-bottom: 3rem; }

	h2 {
		font-size: var(--text-xl);
		margin: 0;
		color: var(--text-primary);
		font-weight: 500;
	}

	.section-desc {
		font-size: var(--text-base);
		color: var(--text-mid);
		margin: -0.25rem 0 1.25rem;
		line-height: var(--leading-normal);
	}

	.prompt-editor {
		width: 100%;
		padding: 1.25rem;
		border: 1px solid var(--border-accent);
		border-radius: var(--radius-xl);
		background: var(--bg-input);
		font-size: var(--text-base);
		font-family: var(--font-mono);
		line-height: 1.7;
		color: var(--text-primary);
		resize: vertical;
		box-sizing: border-box;
		transition: all 0.25s var(--ease-out);
		min-height: 240px;
	}

	.prompt-editor:focus {
		border-color: var(--accent);
		outline: none;
		background: var(--bg-surface);
		box-shadow: var(--shadow-focus);
	}

	.prompt-actions {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-top: 1rem;
	}

	.prompt-hint {
		font-size: 0.9rem;
		color: var(--text-muted);
	}

	.prompt-actions-right {
		display: flex;
		gap: 0.75rem;
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

	.btn:disabled {
		opacity: 0.45;
		cursor: default;
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
</style>
