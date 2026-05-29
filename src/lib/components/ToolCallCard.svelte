<script lang="ts">
	import type { ToolResult } from './types';

	let { name, args, result = undefined }: { name: string; args: Record<string, unknown>; result?: ToolResult } = $props();

	function formatArgs(args: Record<string, unknown>): string {
		const s = JSON.stringify(args, null, 2);
		return s.length > 200 ? s.slice(0, 200) + '...' : s;
	}

	let done = $derived(!!result);
	let errored = $derived(result ? !result.success : false);
</script>

<div class="tool-call" class:tool-done={done}>
	<div class="tool-header">
		<span class="material-symbols-rounded tool-icon">
			{errored ? 'warning' : done ? 'check_circle' : 'pending'}
		</span>
		<span class="tool-name">{name}</span>
	</div>
	<div class="tool-args">
		<pre>{formatArgs(args)}</pre>
	</div>
	{#if result}
		<div class="tool-output" class:tool-error={errored}>
			<span class="material-symbols-rounded">
				{errored ? 'warning' : 'terminal'}
			</span>
			{result.output}
		</div>
	{/if}
</div>

<style>
	.tool-call {
		background: #FDFBF7;
		border: 1px solid #EAE4DC;
		border-radius: 16px;
		padding: 0.75rem 1rem;
		font-size: 0.85rem;
	}

	.tool-call.tool-done {
		border-color: #D6E0D9;
		background: #F8FAF8;
	}

	.tool-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.tool-icon {
		font-size: 18px !important;
		color: #D4A373;
	}

	.tool-done .tool-icon {
		color: #6B7F72;
	}

	.tool-name {
		font-weight: 500;
		color: #6D645D;
	}

	.tool-args pre {
		margin: 0.5rem 0 0;
		padding: 0.5rem 0.75rem;
		background: #F4EFE6;
		border-radius: 8px;
		font-size: 0.8rem;
		overflow-x: auto;
		white-space: pre-wrap;
		color: #6D645D;
	}

	.tool-output {
		display: flex;
		align-items: flex-start;
		gap: 0.4rem;
		margin-top: 0.5rem;
		font-size: 0.8rem;
		color: #6D645D;
		max-height: 200px;
		overflow-y: auto;
		white-space: pre-wrap;
		font-family: 'Roboto Mono', monospace;
	}

	.tool-output .material-symbols-rounded {
		font-size: 16px;
		flex-shrink: 0;
	}

	.tool-error {
		color: #D32F2F;
	}
</style>
