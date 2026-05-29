<script lang="ts">
	import type { UIMessage } from '$lib/components/types';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import ChatInput from '$lib/components/ChatInput.svelte';
	import MessageBubble from '$lib/components/MessageBubble.svelte';

	let messages = $state<UIMessage[]>([]);
	let input = $state('');
	let streaming = $state(false);
	let sessionId = $state<string | null>(null);
	let currentAssistant = $state<UIMessage | null>(null);
	let frontendConfirms = new Map<string, () => void>();
	let focusTrigger = $state(0);
	let inputQueue: string[] = $state([]);
	let abortController: AbortController | null = null;

	let messagesEl = $state<HTMLDivElement>();

	function scrollToBottom() {
		if (messagesEl) {
			setTimeout(() => {
				messagesEl!.scrollTop = messagesEl!.scrollHeight;
			}, 16);
		}
	}

	function finishStreaming() {
		if (currentAssistant) {
			currentAssistant.done = true;
			currentAssistant = null;
		}
		abortController = null;
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

	async function sendMessage(queuedText?: string) {
		const text = (queuedText ?? input).trim();
		if (!text) return;

		if (streaming) {
			inputQueue.push(text);
			if (!queuedText) { input = ''; focusTrigger++; }
			return;
		}

		if (!queuedText) { input = ''; focusTrigger++; }

		messages.push({
			id: crypto.randomUUID(),
			role: 'user',
			blocks: [{ type: 'text', content: text }],
			done: true
		});
		scrollToBottom();

		streaming = true;
		const controller = new AbortController();
		abortController = controller;

		try {
			const res = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ sessionId, message: text }),
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

			finishStreaming();
		} catch (e) {
			if ((e as Error).name === 'AbortError') {
				if (currentAssistant) {
					currentAssistant.done = true;
					currentAssistant = null;
				}
				abortController = null;
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
					sessionId = event.newSessionId as string;
				}
				break;
			}

			case 'done': {
				break;
			}
		}
	}
</script>

<div class="chat-container">
	<div class="messages" bind:this={messagesEl}>
		{#if messages.length === 0}
			<EmptyState />
		{/if}

		{#each messages as msg (msg.id)}
			<MessageBubble message={msg} onconfirm={handleConfirm} />
		{/each}
	</div>

	<ChatInput
		bind:value={input}
		streaming={streaming}
		queueCount={inputQueue.length}
		onsend={() => sendMessage()}
		onstop={stopAI}
		focusTrigger={focusTrigger}
	/>
</div>

<style>
	.chat-container {
		display: flex;
		flex-direction: column;
		height: calc(100vh - 64px);
		max-width: 900px;
		margin: 0 auto;
	}

	.messages {
		flex: 1;
		overflow-y: auto;
		padding: 2rem 2rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 1.5rem; /* slightly larger gap between messages */
		scroll-behavior: smooth;
	}
	
	/* Hide scrollbar for cleaner look, but keep functionality */
	.messages::-webkit-scrollbar {
		width: 6px;
	}
	.messages::-webkit-scrollbar-track {
		background: transparent;
	}
	.messages::-webkit-scrollbar-thumb {
		background-color: rgba(166, 155, 147, 0.3);
		border-radius: 10px;
	}
</style>
