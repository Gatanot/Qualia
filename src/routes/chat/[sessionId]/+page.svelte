<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import type { UIMessage } from '$lib/components/types';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import ChatInput from '$lib/components/ChatInput.svelte';
	import MessageBubble from '$lib/components/MessageBubble.svelte';
	import { sessions, loadSessions, createSession, bumpSession, loadMessages, pendingFirstMessage } from '$lib/session-store';
	import type { MessageRecord } from '$lib/storage';

	let sessionId = $derived($page.params.sessionId);
	let messages = $state<UIMessage[]>([]);
	let input = $state('');
	let streaming = $state(false);
	let currentAssistant = $state<UIMessage | null>(null);
	let frontendConfirms = new Map<string, () => void>();
	let focusTrigger = $state(0);
	let inputQueue: string[] = $state([]);
	let abortController: AbortController | null = null;
	let streamReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
	let nearBottom = $state(true);
	let lastUserMessage = $state('');
	let messagesEl = $state<HTMLDivElement>();
	let loadedSessionId = $state('');
	let contextWindow = $state<number | undefined>(undefined);
	let customIcon = $state(false);
	const SCROLL_THRESHOLD = 150;

	const cumulativeUsage = $derived.by(() => {
		let total = 0;
		for (let i = messages.length - 1; i >= 0; i--) {
			const msg = messages[i];
			if (msg.role === 'assistant' && msg.usage) {
				total = msg.usage.total_tokens;
				break;
			}
		}
		const pct = contextWindow && total > 0 ? ((total / contextWindow) * 100).toFixed(1) : null;
		return { total, pct };
	});

	$effect(() => {
		loadSessions();
	});

	$effect(() => {
		fetch('/api/config')
			.then(r => r.json())
			.then((config) => {
				const provider = config.providers?.find((p: { name: string }) => p.name === config.activeProvider);
				const model = provider?.models?.find((m: { id: string }) => m.id === provider.activeModel) || provider?.models?.[0];
				if (model?.contextWindow) {
					contextWindow = model.contextWindow;
				}
				customIcon = config.customBrandIcon === true;
			})
			.catch(() => {});
	});

	$effect(() => {
		if (sessionId && sessionId !== loadedSessionId) {
			loadedSessionId = sessionId;
			messages = [];
			currentAssistant = null;
			loadMessages(sessionId).then((records) => {
				if ($page.params.sessionId !== sessionId) return;
				messages = recordsToUIMessages(records);
				forceScrollToBottom();
				const pending = $pendingFirstMessage;
				if (pending && records.length === 0) {
					pendingFirstMessage.set('');
					sendMessage(pending);
				}
			});
		}
	});

	function recordsToUIMessages(records: MessageRecord[]): UIMessage[] {
		const result: UIMessage[] = [];
		for (const r of records) {
			if (r.role === 'system') continue;
			if (r.role === 'user') {
				result.push({
					id: r.id,
					role: 'user',
					blocks: [{ type: 'text', content: r.content }],
					done: true
				});
			} else if (r.role === 'assistant') {
				const blocks: Array<{ type: 'text' | 'reasoning' | 'tool'; content?: string; name?: string; args?: Record<string, unknown>; result?: { success: boolean; output: string } }> = [];
				if (r.reasoning_content) {
					blocks.push({ type: 'reasoning', content: r.reasoning_content });
				}
				if (r.content) {
					blocks.push({ type: 'text', content: r.content });
				}
				if (r.tool_calls) {
					for (const tc of r.tool_calls) {
						let args: Record<string, unknown> = {};
						try { args = JSON.parse(tc.function.arguments); } catch { /* empty */ }
						blocks.push({ type: 'tool', name: tc.function.name, args });
					}
				}
				result.push({
					id: r.id,
					role: 'assistant',
					blocks: blocks as UIMessage['blocks'],
					done: true,
					usage: r.usage
				});
			} else if (r.role === 'tool') {
				const last = result[result.length - 1];
				if (last?.role === 'assistant') {
					for (let i = last.blocks.length - 1; i >= 0; i--) {
						const b = last.blocks[i];
						if (b.type === 'tool' && !b.result) {
							b.result = { success: true, output: r.content };
							break;
						}
					}
				}
			}
		}
		return result;
	}

	function checkNearBottom(): boolean {
		if (!messagesEl) return true;
		const { scrollHeight, scrollTop, clientHeight } = messagesEl;
		return scrollHeight - scrollTop - clientHeight < SCROLL_THRESHOLD;
	}

	function onPageScroll() {
		nearBottom = checkNearBottom();
	}

	function scrollToBottom() {
		requestAnimationFrame(() => {
			if (!messagesEl || !checkNearBottom()) return;
			messagesEl.scrollTop = messagesEl.scrollHeight;
		});
	}

	function forceScrollToBottom() {
		nearBottom = true;
		requestAnimationFrame(() => {
			if (!messagesEl) return;
			messagesEl.scrollTo({ top: messagesEl.scrollHeight, behavior: 'smooth' });
		});
	}

	$effect(() => {
		const el = messagesEl;
		if (!el) return;
		el.addEventListener('scroll', onPageScroll, { passive: true });
		return () => el.removeEventListener('scroll', onPageScroll);
	});

	function finishStreaming() {
		if (currentAssistant) {
			currentAssistant.done = true;
			currentAssistant = null;
		}
		abortController = null;
		streamReader = null;
		streaming = false;
		focusTrigger++;
		scrollToBottom();

		if (inputQueue.length > 0) {
			const next = inputQueue.shift()!;
			sendMessage(next);
		}
	}

	function stopAI() {
		abortController?.abort();
		streamReader?.cancel().catch(() => {});
		streamReader = null;
	}

	function handleConfirm(confirmId: string, approved: boolean) {
		for (const msg of messages) {
			const idx = msg.blocks.findIndex(b => b.type === 'confirm' && b.confirmId === confirmId);
			if (idx !== -1) {
				msg.blocks.splice(idx, 1);
				break;
			}
		}

		fetch('/api/confirm', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ confirmId, approved })
		});

		const resolve = frontendConfirms.get(confirmId);
		if (resolve) {
			frontendConfirms.delete(confirmId);
			resolve();
		}
	}

	function handleRecovery(action: 'retry' | 'rollback') {
		const recoveryMsg = messages.find(
			(m) => m.blocks.some((b) => b.type === 'error_recovery')
		);
		if (recoveryMsg) {
			const idx = messages.indexOf(recoveryMsg);
			if (idx !== -1) messages.splice(idx, 1);
		}

		if (action === 'retry') {
			if (lastUserMessage) sendMessage(lastUserMessage, true);
		} else {
			input = lastUserMessage;
			focusTrigger++;
		}
	}

	async function handleRollback(messageId: string) {
		if (streaming) {
			stopAI();
			await new Promise((r) => setTimeout(r, 100));
		}

		const idx = messages.findIndex((m) => m.id === messageId);
		if (idx === -1) return;

		const targetMsg = messages[idx];
		const rollbackText = targetMsg.blocks
			.filter((b) => b.type === 'text')
			.map((b) => b.content)
			.join('\n');

		if (idx < messages.length - 1) {
			messages.splice(idx + 1);
		}
		messages.splice(idx, 1);

		fetch('/api/messages', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'deleteFrom', sessionId: sessionId, messageId })
		}).catch(() => {});

		input = rollbackText;
		focusTrigger++;
	}

	async function sendMessage(queuedText?: string, skipUserMsg = false) {
		const text = (queuedText ?? input).trim();
		if (!text) return;

		if (streaming) {
			if (!skipUserMsg) {
				inputQueue.push(text);
				if (!queuedText) { input = ''; focusTrigger++; }
			}
			return;
		}

		if (!queuedText) { input = ''; focusTrigger++; }

		lastUserMessage = text;
		const userMsgId = crypto.randomUUID();

		if (!skipUserMsg) {
			messages.push({
				id: userMsgId,
				role: 'user',
				blocks: [{ type: 'text', content: text }],
				done: true
			});
			forceScrollToBottom();
		}

		streaming = true;
		const controller = new AbortController();
		abortController = controller;
		streamReader = null;

		try {
			const res = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ sessionId: sessionId, message: text, clientMessageId: skipUserMsg ? undefined : userMsgId }),
				signal: controller.signal
			});

			if (!res.ok) {
				const err = await res.json().catch(() => ({ error: '请求失败' }));
				messages.push({
					id: crypto.randomUUID(),
					role: 'error',
					blocks: [{ type: 'text', content: err.error || '请求失败' }],
					done: true
				});
				finishStreaming();
				return;
			}

			const newSid = res.headers.get('X-Session-Id');
			if (newSid && newSid !== sessionId) {
				bumpSession(newSid);
				goto('/chat/' + newSid, { replaceState: true });
				return;
			} else if (newSid) {
				bumpSession(newSid);
			}

			const reader = res.body!.getReader();
			streamReader = reader;
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
					}
				}
			}

			finishStreaming();
		} catch (e) {
			if ((e as Error).name === 'AbortError') {
				if (currentAssistant) {
					currentAssistant.done = true;
					currentAssistant = null;
				}
				abortController = null;
				streamReader = null;
				streaming = false;
				focusTrigger++;
				if (inputQueue.length > 0) sendMessage(inputQueue.shift());
				return;
			}

			messages.push({
				id: crypto.randomUUID(),
				role: 'error',
				blocks: [{ type: 'text', content: (e as Error).message || '连接失败' }],
				done: true
			});
			finishStreaming();
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
						blocks: [{ type: 'text', content: text }],
						done: false
					};
					messages.push(currentAssistant);
				} else {
					const blocks = currentAssistant.blocks;
					const lastBlock = blocks[blocks.length - 1];
					if (lastBlock && lastBlock.type === 'text') {
						lastBlock.content += text;
					} else {
						blocks.push({ type: 'text', content: text });
					}
				}
				scrollToBottom();
				break;
			}

			case 'reasoning': {
				const text = event.text as string;
				if (!currentAssistant) {
					currentAssistant = {
						id: crypto.randomUUID(),
						role: 'assistant',
						blocks: [{ type: 'reasoning', content: text }],
						done: false
					};
					messages.push(currentAssistant);
				} else {
					const blocks = currentAssistant.blocks;
					const lastBlock = blocks[blocks.length - 1];
					if (lastBlock && lastBlock.type === 'reasoning') {
						lastBlock.content += text;
					} else {
						blocks.push({ type: 'reasoning', content: text });
					}
				}
				scrollToBottom();
				break;
			}

			case 'tool_call': {
				if (!currentAssistant) {
					currentAssistant = { id: crypto.randomUUID(), role: 'assistant', blocks: [], done: false };
					messages.push(currentAssistant);
				}
				currentAssistant.blocks.push({
					type: 'tool',
					name: event.name as string,
					args: event.args as Record<string, unknown>
				});
				break;
			}

			case 'tool_result': {
				if (!currentAssistant) {
					currentAssistant = { id: crypto.randomUUID(), role: 'assistant', blocks: [], done: false };
					messages.push(currentAssistant);
				}
				const blocks = currentAssistant.blocks;
				for (let i = blocks.length - 1; i >= 0; i--) {
					const block = blocks[i];
					if (block.type === 'tool' && !block.result && block.name === (event.name as string)) {
						block.result = {
							success: event.success as boolean,
							output: event.output as string
						};
						break;
					}
				}
				scrollToBottom();
				break;
			}

			case 'confirm_required': {
				const confirmId = event.confirmId as string;
				const confirmation = event.confirmation as Record<string, unknown>;
				const reason = (confirmation?.reason as string) || '需要确认此操作';

				if (!currentAssistant) {
					currentAssistant = { id: crypto.randomUUID(), role: 'assistant', blocks: [], done: false };
					messages.push(currentAssistant);
				}
				currentAssistant.blocks.push({
					type: 'confirm',
					confirmId,
					message: reason
				});

				await new Promise<void>((resolve) => {
					frontendConfirms.set(confirmId, resolve);
				});
				break;
			}

			case 'error': {
				messages.push({
					id: crypto.randomUUID(),
					role: 'error',
					blocks: [{ type: 'text', content: event.message as string }],
					done: true
				});
				scrollToBottom();
				break;
			}

			case 'forked': {
				if (event.newSessionId) {
					bumpSession(event.newSessionId as string);
					goto('/chat/' + (event.newSessionId as string), { replaceState: true });
				}
				break;
			}

			case 'retrying': {
				if (currentAssistant) {
					const idx = messages.indexOf(currentAssistant);
					if (idx !== -1) messages.splice(idx, 1);
					currentAssistant = null;
				}
				break;
			}

			case 'retry_exhausted': {
				if (currentAssistant) {
					const idx = messages.indexOf(currentAssistant);
					if (idx !== -1) messages.splice(idx, 1);
					currentAssistant = null;
				}
				currentAssistant = {
					id: crypto.randomUUID(),
					role: 'assistant',
					blocks: [{ type: 'error_recovery', message: event.message as string }],
					done: true
				};
				messages.push(currentAssistant);
				currentAssistant = null;
				streaming = false;
				focusTrigger++;
				break;
			}

			case 'done': {
				if (currentAssistant && event.usage) {
					currentAssistant.usage = event.usage as import('$lib/provider').Usage;
				}
				if (event.contextWindow) {
					contextWindow = event.contextWindow as number;
				}
				break;
			}
		}
	}
</script>

<div class="chat-container">
	<div class="messages" class:welcome={messages.length === 0} bind:this={messagesEl}>
		{#if messages.length === 0}
			<EmptyState customIcon={customIcon} />
		{/if}

		{#each messages as msg (msg.id)}
			<MessageBubble message={msg} onconfirm={handleConfirm} onrecovery={handleRecovery} onrollback={handleRollback} />
		{/each}

		{#if cumulativeUsage.total > 0}
			<div class="stats-line">
				<span class="stats-label">Token</span>
				<span class="stats-value">{cumulativeUsage.total}</span>
				{#if contextWindow}
					<span class="stats-sep">/</span>
					<span class="stats-max">{contextWindow}</span>
					{#if cumulativeUsage.pct}
						<span class="stats-pct">({cumulativeUsage.pct}%)</span>
					{/if}
				{/if}
			</div>
		{/if}
	</div>

	{#if !nearBottom && streaming}
		<button class="scroll-btn" onclick={forceScrollToBottom}>
			<span class="material-symbols-rounded">arrow_downward</span>
		</button>
	{/if}

	<div class="input-anchor">
		<ChatInput
			bind:value={input}
			streaming={streaming}
			queueCount={inputQueue.length}
			onsend={() => sendMessage()}
			onstop={stopAI}
			focusTrigger={focusTrigger}
		/>
	</div>
</div>

<style>
	.chat-container {
		display: flex;
		flex-direction: column;
		height: 100%;
		max-width: 900px;
		margin: 0 auto;
		position: relative;
	}

	.messages {
		padding: 2rem 2rem 120px;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		overflow-y: auto;
		scrollbar-width: none;
	}

	.messages::-webkit-scrollbar {
		display: none;
	}

	.messages.welcome {
		flex: 1;
		justify-content: center;
		align-items: center;
		padding-bottom: 2rem;
	}

	.input-anchor {
		position: sticky;
		bottom: 0;
		margin-top: auto;
		z-index: 10;
		background: linear-gradient(to top, var(--bg-page) 70%, transparent);
		padding-top: 0.75rem;
	}

	.scroll-btn {
		position: absolute;
		bottom: 100px;
		right: 2rem;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		border: 1px solid var(--border-strong);
		background: var(--bg-surface);
		color: var(--text-darker);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: var(--shadow-md);
		z-index: 20;
		transition: transform 0.15s, box-shadow 0.15s;
		animation: scrollFadeIn 0.2s ease;
	}

	.scroll-btn:hover {
		transform: translateY(-2px);
		box-shadow: var(--shadow-md);
	}

	.scroll-btn .material-symbols-rounded {
		font-size: 20px;
	}

	@keyframes scrollFadeIn {
		from { opacity: 0; transform: scale(0.9) translateY(4px); }
		to { opacity: 1; transform: scale(1) translateY(0); }
	}

	.stats-line {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.5rem 0;
		font-size: 0.72rem;
		color: var(--text-muted);
		border-top: 1px solid var(--border-subtle);
	}

	.stats-label {
		font-weight: 500;
	}

	.stats-value {
		font-weight: 600;
		color: var(--text-mid);
	}

	.stats-sep {
		color: var(--scrollbar);
	}

	.stats-max {
		color: var(--text-mid);
	}

	.stats-pct {
		color: var(--accent-link);
		font-weight: 500;
	}
</style>
