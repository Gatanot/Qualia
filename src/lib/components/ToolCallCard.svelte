<script lang="ts">
	import type { ToolResult } from './types';

	let { name, args, result = undefined }: { name: string; args: Record<string, unknown>; result?: ToolResult } = $props();

	let expanded = $state(false);

	function formatArgs(args: Record<string, unknown>): string {
		const s = JSON.stringify(args, null, 2);
		return s.length > 200 ? s.slice(0, 200) + '...' : s;
	}

	let done = $derived(!!result);
	let errored = $derived(result ? !result.success : false);

	let summary = $derived.by(() => {
		const command = args.command as string;
		if (command) {
			return command.length > 60 ? command.slice(0, 60) + '…' : command;
		}
		const keys = Object.keys(args);
		if (keys.length === 1) {
			const v = String(args[keys[0]]);
			return v.length > 60 ? v.slice(0, 60) + '…' : v;
		}
		return '';
	});

	function toggle() {
		expanded = !expanded;
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="tool-call" class:tool-done={done} class:expanded>
	<div class="tool-header" onclick={toggle}>
		<span class="material-symbols-rounded tool-icon">
			{errored ? 'warning' : done ? 'check_circle' : 'pending'}
		</span>
		<div class="tool-summary">
			<span class="tool-name">{name}</span>
			{#if summary && !expanded}
				<span class="tool-command">{summary}</span>
			{/if}
		</div>
		<span class="material-symbols-rounded expand-icon">
			{expanded ? 'expand_less' : 'expand_more'}
		</span>
	</div>

	{#if expanded}
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
	{/if}
</div>

<style>
	.tool-call {
		background: #FFFFFF;
		border: 1px solid rgba(230, 226, 216, 0.6);
		border-radius: 16px;
		padding: 0.75rem 1rem;
		font-size: 0.85rem;
		transition: border-color 0.2s, background 0.2s;
		box-shadow: 0 1px 2px rgba(61, 56, 52, 0.02);
	}

	.tool-call.tool-done {
		border-color: rgba(214, 224, 217, 0.6);
		background: #F8FAF8;
	}

	.tool-header {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		cursor: pointer;
		user-select: none;
	}

	.tool-icon {
		font-size: 18px !important;
		color: #D4A373;
		flex-shrink: 0;
	}

	.tool-done .tool-icon {
		color: #5E7163;
	}

	.tool-summary {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.tool-name {
		font-weight: 500;
		color: #3D3834;
		flex-shrink: 0;
	}

	.tool-command {
		color: #706862;
		font-size: 0.8rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-family: 'Roboto Mono', monospace;
	}

	.expand-icon {
		font-size: 20px;
		color: #A39B93;
		flex-shrink: 0;
		transition: transform 0.2s;
	}

	.tool-args pre {
		margin: 0.75rem 0 0;
		padding: 0.6rem 0.85rem;
		background: #F4F1EA;
		border-radius: 8px;
		font-size: 0.8rem;
		overflow-x: auto;
		white-space: pre-wrap;
		color: #706862;
	}

	.tool-output {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		margin-top: 0.6rem;
		font-size: 0.8rem;
		color: #706862;
		max-height: 200px;
		overflow-y: auto;
		white-space: pre-wrap;
		font-family: 'Roboto Mono', monospace;
	}
	
	.tool-output::-webkit-scrollbar, .tool-args pre::-webkit-scrollbar {
		width: 4px;
		height: 4px;
	}
	.tool-output::-webkit-scrollbar-thumb, .tool-args pre::-webkit-scrollbar-thumb {
		background-color: rgba(166, 155, 147, 0.3);
		border-radius: 10px;
	}

	.tool-output .material-symbols-rounded {
		font-size: 16px;
		flex-shrink: 0;
	}

	.tool-error {
		color: #B71C1C;
	}
</style>
