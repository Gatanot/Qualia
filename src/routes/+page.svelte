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
				<div class="empty-icon">spa</div>
				<h2>Qualia</h2>
				<p>你的虚拟伙伴，随时倾听</p>
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
							spa
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
		height: calc(100vh - 64px);
		max-width: 860px;
		margin: 0 auto;
	}

	.messages {
		flex: 1;
		overflow-y: auto;
		padding: 1.5rem 1.5rem 2rem;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		flex: 1;
		color: #8C847D;
		gap: 0.75rem;
	}

	.empty-icon {
		font-family: 'Material Symbols Rounded';
		font-size: 3.5rem;
		margin-bottom: 0.5rem;
		color: #A3A8A0;
	}

	.empty-state h2 {
		margin: 0;
		font-weight: 500;
		font-size: 1.75rem;
		color: #4A433E;
		letter-spacing: 0.5px;
	}

	.empty-state p {
		margin: 0;
		font-size: 1rem;
		color: #8C847D;
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
		width: 40px;
		height: 40px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 22px;
	}

	.message-row:not(.user) .message-avatar {
		background: #F4EFE6;
		color: #6B7F72;
	}

	.message-row.user .message-avatar {
		background: #6B7F72;
		color: #fff;
	}

	.message-row.error .message-avatar {
		background: #FDECEA;
		color: #D32F2F;
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
		color: #8C847D;
		margin-bottom: 0.4rem;
		padding: 0 0.25rem;
	}

	.message-content {
		background: #fff;
		border-radius: 4px 24px 24px 24px;
		padding: 0.85rem 1.25rem;
		font-size: 0.95rem;
		line-height: 1.6;
		white-space: pre-wrap;
		word-break: break-word;
		box-shadow: 0 2px 12px rgba(74, 67, 62, 0.04);
		color: #4A433E;
	}

	.message-row.user .message-content {
		background: #6B7F72;
		color: #fff;
		border-radius: 24px 4px 24px 24px;
	}

	.message-row.error .message-content {
		background: #FDECEA;
		color: #C62828;
		border-radius: 4px 24px 24px 24px;
	}

	.cursor {
		animation: blink 0.7s infinite;
		font-weight: 700;
		color: #6B7F72;
	}

	@keyframes blink {
		0%, 100% { opacity: 1; }
		50% { opacity: 0; }
	}

	.tool-calls {
		margin-top: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

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

	.input-bar {
		display: flex;
		gap: 0.5rem;
		margin: 0 1.5rem 1.5rem;
		padding: 0.5rem 0.5rem 0.5rem 1rem;
		background: #fff;
		border-radius: 32px;
		align-items: flex-end;
		box-shadow: 0 4px 20px rgba(74, 67, 62, 0.08);
		border: 1px solid #EAE4DC;
	}

	.chat-input {
		flex: 1;
		padding: 0.6rem 0;
		border: none;
		background: transparent;
		font-family: inherit;
		font-size: 0.95rem;
		resize: none;
		max-height: 120px;
		line-height: 1.5;
		outline: none;
		color: #4A433E;
	}
	
	.chat-input::placeholder {
		color: #A69E96;
	}

	.send-btn {
		width: 44px;
		height: 44px;
		border-radius: 50%;
		border: none;
		background: #6B7F72;
		color: #fff;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		transition: background 0.2s, transform 0.1s;
		margin-bottom: 2px;
	}

	.send-btn:hover:not(:disabled) {
		background: #5A6B60;
		transform: scale(1.05);
	}

	.send-btn:disabled {
		background: #D6CFC7;
		cursor: default;
	}

	.send-btn .material-symbols-rounded {
		font-size: 22px;
	}

	.confirm-overlay {
		position: fixed;
		inset: 0;
		background: rgba(74, 67, 62, 0.4);
		backdrop-filter: blur(2px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 200;
	}

	.confirm-dialog {
		background: #fff;
		border-radius: 28px;
		padding: 2.5rem 2rem;
		max-width: 400px;
		width: 90%;
		text-align: center;
		box-shadow: 0 12px 40px rgba(74, 67, 62, 0.15);
	}

	.confirm-icon {
		color: #D4A373;
		font-size: 2.5rem;
		margin-bottom: 1rem;
	}

	.confirm-dialog h3 {
		margin: 0 0 0.75rem;
		font-weight: 500;
		color: #4A433E;
		font-size: 1.25rem;
	}

	.confirm-dialog p {
		margin: 0 0 2rem;
		color: #6D645D;
		font-size: 0.95rem;
		white-space: pre-wrap;
		word-break: break-word;
		line-height: 1.5;
	}

	.confirm-actions {
		display: flex;
		gap: 0.75rem;
		justify-content: center;
	}

	.btn {
		padding: 0.6rem 1.75rem;
		border-radius: 100px;
		border: none;
		font-family: inherit;
		font-size: 0.9rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn-primary {
		background: #6B7F72;
		color: #fff;
	}

	.btn-primary:hover {
		background: #5A6B60;
	}

	.btn-outline {
		background: #F4EFE6;
		color: #6D645D;
	}

	.btn-outline:hover {
		background: #EAE4DC;
	}
</style>
