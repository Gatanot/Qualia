<script lang="ts">
	interface ToolCallEntry {
		name: string;
		args: Record<string, unknown>;
		result?: { success: boolean; output: string };
	}

	interface UIMessage {
		id: string;
		role: 'user' | 'assistant' | 'tool' | 'error';
		content: string;
		done: boolean;
		toolCalls?: ToolCallEntry[];
	}

	let messages = $state<UIMessage[]>([]);
	let input = $state('');
	let streaming = $state(false);
	let sessionId = $state<string | null>(null);
	let currentAssistant = $state<UIMessage | null>(null);

	let confirmDialog = $state<{
		confirmId: string;
		message: string;
		resolve: ((v: boolean) => void) | null;
	} | null>(null);

	let messagesEl = $state<HTMLDivElement>();

	function scrollToBottom() {
		if (messagesEl) {
			setTimeout(() => {
				messagesEl!.scrollTop = messagesEl!.scrollHeight;
			}, 16);
		}
	}

	async function sendMessage() {
		const text = input.trim();
		if (!text || streaming) return;
		input = '';

		messages.push({
			id: crypto.randomUUID(),
			role: 'user',
			content: text,
			done: true
		});
		scrollToBottom();

		streaming = true;

		try {
		const res = await fetch('/api/chat', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ sessionId, message: text })
		});

		if (!res.ok) {
			const err = await res.json().catch(() => ({ error: '请求失败' }));
			messages.push({
				id: crypto.randomUUID(),
				role: 'error',
				content: err.error || '请求失败',
				done: true
			});
			streaming = false;
			return;
		}

		const newSid = res.headers.get('X-Session-Id');
		if (newSid) sessionId = newSid;

		const reader = res.body!.getReader();
		const decoder = new TextDecoder();
		let buffer = '';

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });
			const lines = buffer.split('\n');
			buffer = lines.pop() || '';

			for (const line of lines) {
				const trimmed = line.trim();
				if (!trimmed || !trimmed.startsWith('data:')) continue;

				const data = trimmed.slice(5).trim();
				try {
					const event = JSON.parse(data);
					await handleSSEEvent(event);
				} catch {
					// skip
				}
			}
		}

		if (currentAssistant) {
			currentAssistant.done = true;
			currentAssistant = null;
		}
		streaming = false;
		scrollToBottom();

		} catch (e) {
			messages.push({
				id: crypto.randomUUID(),
				role: 'error',
				content: (e as Error).message || '连接失败',
				done: true
			});
			streaming = false;
		}
	}

	async function handleSSEEvent(event: Record<string, unknown>) {
		switch (event.type) {
			case 'content': {
				const text = event.text as string;
				if (!currentAssistant) {
					currentAssistant = {
						id: crypto.randomUUID(),
						role: 'assistant',
						content: text,
						done: false,
						toolCalls: []
					};
					messages.push(currentAssistant);
				} else {
					currentAssistant.content += text;
				}
				scrollToBottom();
				break;
			}

			case 'tool_call': {
				if (currentAssistant && currentAssistant.toolCalls) {
					currentAssistant.toolCalls.push({
						name: event.name as string,
						args: event.args as Record<string, unknown>
					});
				}
				break;
			}

			case 'tool_result': {
				const entry = currentAssistant?.toolCalls?.find(
					(tc) => tc.name === (event.name as string) && !tc.result
				);
				if (entry) {
					entry.result = {
						success: event.success as boolean,
						output: event.output as string
					};
				}
				scrollToBottom();
				break;
			}

			case 'confirm_required': {
				const confirmId = event.confirmId as string;
				const msg = (event.confirmation as Record<string, unknown>)?.reason as string || '需要确认此操作';

				await new Promise<void>((resolve) => {
					confirmDialog = {
						confirmId,
						message: msg,
						resolve: (approved: boolean) => {
							confirmDialog = null;
							fetch('/api/confirm', {
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify({ confirmId, approved })
							});
							resolve();
						}
					};
				});
				break;
			}

			case 'error': {
				messages.push({
					id: crypto.randomUUID(),
					role: 'error',
					content: event.message as string,
					done: true
				});
				scrollToBottom();
				break;
			}

			case 'forked': {
				if (event.newSessionId) {
					sessionId = event.newSessionId as string;
				}
				break;
			}

			case 'done': {
				break;
			}
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}
	}

	function formatArgs(args: Record<string, unknown>): string {
		const s = JSON.stringify(args, null, 2);
		return s.length > 200 ? s.slice(0, 200) + '...' : s;
	}
</script>

<div class="chat-container">
	<div class="messages" bind:this={messagesEl}>
		{#if messages.length === 0}
			<div class="empty-state">
				<div class="empty-icon">chat</div>
				<h2>Qualia</h2>
				<p>你的虚拟 AI 伙伴，随时开始对话</p>
			</div>
		{/if}

		{#each messages as msg (msg.id)}
			<div class="message-row" class:user={msg.role === 'user'} class:error={msg.role === 'error'}>
				<div class="message-avatar">
					<span class="material-symbols-rounded">
						{#if msg.role === 'user'}
							person
						{:else if msg.role === 'error'}
							error
						{:else}
							smart_toy
						{/if}
					</span>
				</div>
				<div class="message-body">
					<div class="message-role">
						{msg.role === 'user' ? '你' : msg.role === 'error' ? '错误' : 'Qualia'}
					</div>

					{#if msg.content}
						<div class="message-content">{msg.content}</div>
					{/if}

					{#if msg.toolCalls && msg.toolCalls.length > 0}
						<div class="tool-calls">
							{#each msg.toolCalls as tc}
								<div class="tool-call" class:tool-done={!!tc.result}>
									<div class="tool-header">
										<span class="material-symbols-rounded tool-icon">
											{tc.result ? 'check_circle' : 'pending'}
										</span>
										<span class="tool-name">{tc.name}</span>
									</div>
									<div class="tool-args">
										<pre>{formatArgs(tc.args)}</pre>
									</div>
									{#if tc.result}
										<div class="tool-output" class:tool-error={!tc.result.success}>
											<span class="material-symbols-rounded">
												{tc.result.success ? 'terminal' : 'warning'}
											</span>
											{tc.result.output}
										</div>
									{/if}
								</div>
							{/each}
						</div>
					{/if}

					{#if !msg.done}
						<span class="cursor">|</span>
					{/if}
				</div>
			</div>
		{/each}
	</div>

	<div class="input-bar">
		<textarea
			class="chat-input"
			bind:value={input}
			onkeydown={handleKeydown}
			placeholder="输入消息..."
			rows={1}
			disabled={streaming}
		></textarea>
		<button
			class="send-btn"
			onclick={sendMessage}
			disabled={streaming || !input.trim()}
		>
			<span class="material-symbols-rounded">send</span>
		</button>
	</div>
</div>

{#if confirmDialog}
	<div class="confirm-overlay" role="dialog">
		<div class="confirm-dialog">
			<div class="confirm-icon">
				<span class="material-symbols-rounded">warning</span>
			</div>
			<h3>确认操作</h3>
			<p>{confirmDialog.message}</p>
			<div class="confirm-actions">
				<button class="btn btn-outline" onclick={() => confirmDialog?.resolve?.(false)}>
					拒绝
				</button>
				<button class="btn btn-primary" onclick={() => confirmDialog?.resolve?.(true)}>
					允许
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.chat-container {
		display: flex;
		flex-direction: column;
		height: calc(100vh - 56px);
		max-width: 860px;
		margin: 0 auto;
	}

	.messages {
		flex: 1;
		overflow-y: auto;
		padding: 1rem 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		flex: 1;
		color: #9e9e9e;
		gap: 0.5rem;
	}

	.empty-icon {
		font-family: 'Material Symbols Rounded';
		font-size: 3rem;
		margin-bottom: 0.5rem;
	}

	.empty-state h2 {
		margin: 0;
		font-weight: 500;
		font-size: 1.5rem;
		color: #616161;
	}

	.empty-state p {
		margin: 0;
		font-size: 0.9rem;
	}

	.message-row {
		display: flex;
		gap: 0.75rem;
		max-width: 100%;
	}

	.message-row.user {
		flex-direction: row-reverse;
	}

	.message-avatar {
		flex-shrink: 0;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 20px;
	}

	.message-row:not(.user) .message-avatar {
		background: #e3f2fd;
		color: #1976d2;
	}

	.message-row.user .message-avatar {
		background: #1976d2;
		color: #fff;
	}

	.message-row.error .message-avatar {
		background: #ffebee;
		color: #d32f2f;
	}

	.message-body {
		min-width: 0;
		flex: 1;
	}

	.message-row.user .message-body {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
	}

	.message-role {
		font-size: 0.8rem;
		font-weight: 500;
		color: #757575;
		margin-bottom: 0.25rem;
	}

	.message-content {
		background: #fff;
		border-radius: 12px;
		padding: 0.75rem 1rem;
		font-size: 0.925rem;
		line-height: 1.55;
		white-space: pre-wrap;
		word-break: break-word;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
	}

	.message-row.user .message-content {
		background: #1976d2;
		color: #fff;
	}

	.message-row.error .message-content {
		background: #ffebee;
		color: #c62828;
	}

	.cursor {
		animation: blink 0.7s infinite;
		font-weight: 700;
		color: #1976d2;
	}

	@keyframes blink {
		0%, 100% { opacity: 1; }
		50% { opacity: 0; }
	}

	.tool-calls {
		margin-top: 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.tool-call {
		background: #fafafa;
		border: 1px solid #e0e0e0;
		border-radius: 8px;
		padding: 0.5rem 0.75rem;
		font-size: 0.8rem;
	}

	.tool-call.tool-done {
		border-color: #c8e6c9;
		background: #f1f8e9;
	}

	.tool-header {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.tool-icon {
		font-size: 16px !important;
		color: #ff9800;
	}

	.tool-done .tool-icon {
		color: #4caf50;
	}

	.tool-name {
		font-weight: 500;
		color: #616161;
	}

	.tool-args pre {
		margin: 0.3rem 0;
		padding: 0.3rem 0.5rem;
		background: #f5f5f5;
		border-radius: 4px;
		font-size: 0.75rem;
		overflow-x: auto;
		white-space: pre-wrap;
	}

	.tool-output {
		display: flex;
		align-items: flex-start;
		gap: 0.3rem;
		margin-top: 0.3rem;
		font-size: 0.78rem;
		color: #616161;
		max-height: 200px;
		overflow-y: auto;
		white-space: pre-wrap;
		font-family: 'Roboto Mono', monospace;
	}

	.tool-output .material-symbols-rounded {
		font-size: 14px;
		flex-shrink: 0;
	}

	.tool-error {
		color: #d32f2f;
	}

	.input-bar {
		display: flex;
		gap: 0.5rem;
		padding: 0.75rem 1.5rem 1rem;
		background: #fff;
		border-top: 1px solid #e0e0e0;
		align-items: flex-end;
		box-shadow: 0 -1px 3px rgba(0, 0, 0, 0.04);
	}

	.chat-input {
		flex: 1;
		padding: 0.6rem 0.75rem;
		border: 1px solid #e0e0e0;
		border-radius: 8px;
		font-family: inherit;
		font-size: 0.9rem;
		resize: none;
		max-height: 120px;
		line-height: 1.4;
		outline: none;
		transition: border-color 0.2s;
	}

	.chat-input:focus {
		border-color: #1976d2;
	}

	.send-btn {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		border: none;
		background: #1976d2;
		color: #fff;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		transition: background 0.2s;
	}

	.send-btn:hover:not(:disabled) {
		background: #1565c0;
	}

	.send-btn:disabled {
		background: #bdbdbd;
		cursor: default;
	}

	.send-btn .material-symbols-rounded {
		font-size: 20px;
	}

	.confirm-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 200;
	}

	.confirm-dialog {
		background: #fff;
		border-radius: 16px;
		padding: 2rem;
		max-width: 420px;
		width: 90%;
		text-align: center;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
	}

	.confirm-icon {
		color: #ff9800;
		font-size: 2.5rem;
		margin-bottom: 0.75rem;
	}

	.confirm-dialog h3 {
		margin: 0 0 0.5rem;
		font-weight: 500;
	}

	.confirm-dialog p {
		margin: 0 0 1.5rem;
		color: #616161;
		font-size: 0.9rem;
		white-space: pre-wrap;
		word-break: break-word;
	}

	.confirm-actions {
		display: flex;
		gap: 0.75rem;
		justify-content: center;
	}

	.btn {
		padding: 0.5rem 1.5rem;
		border-radius: 6px;
		border: none;
		font-family: inherit;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.2s;
	}

	.btn-primary {
		background: #1976d2;
		color: #fff;
	}

	.btn-primary:hover {
		background: #1565c0;
	}

	.btn-outline {
		background: #fff;
		color: #616161;
		border: 1px solid #e0e0e0;
	}

	.btn-outline:hover {
		background: #f5f5f5;
	}
</style>
