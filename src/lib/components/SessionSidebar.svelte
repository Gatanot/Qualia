<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { sessions, createSession, setSessionTitle, deleteSession } from '$lib/session-store';
	import type { Session } from '$lib/storage';

	let { mobileOpen = $bindable(false) } = $props();

	let editingId = $state<string | null>(null);
	let editTitle = $state('');

	function handleSelect(session: Session) {
		goto('/chat/' + session.id);
		mobileOpen = false;
	}

	async function handleNew() {
		const session = await createSession();
		if (session) {
			goto('/chat/' + session.id);
			mobileOpen = false;
		}
	}

	function startEdit(session: Session) {
		editingId = session.id;
		editTitle = session.title || '';
	}

	async function saveEdit(sessionId: string) {
		const title = editTitle.trim();
		if (title) {
			await setSessionTitle(sessionId, title);
		}
		editingId = null;
	}

	function cancelEdit() {
		editingId = null;
	}

	async function handleDelete(sessionId: string) {
		await deleteSession(sessionId);
	}

	function handleEditKeydown(e: KeyboardEvent, sessionId: string) {
		if (e.key === 'Enter') {
			e.preventDefault();
			saveEdit(sessionId);
		} else if (e.key === 'Escape') {
			cancelEdit();
		}
	}

	function formatTime(ts: number): string {
		const d = new Date(ts);
		const now = new Date();
		const diff = now.getTime() - d.getTime();
		if (diff < 86400000) {
			return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
		}
		return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
	}
</script>

<div class="sidebar" class:mobile-open={mobileOpen}>
	<div class="sidebar-header">
		<a href="/" class="brand">
			<span class="material-symbols-rounded brand-icon">spa</span>
			<span class="brand-name">Qualia</span>
		</a>
	</div>

	<div class="section-label">
			<span>对话</span>
			<button class="new-btn" onclick={handleNew}>
				<span class="material-symbols-rounded">add</span>
			</button>
		</div>

		<div class="session-list">
			{#each $sessions as session (session.id)}
				<div
					class="session-item"
					class:active={session.id === $page.params.sessionId}
					onclick={() => handleSelect(session)}
					onkeydown={(e: KeyboardEvent) => e.key === 'Enter' && handleSelect(session)}
					role="button"
					tabindex="0"
				>
					<span class="material-symbols-rounded session-icon">chat_bubble</span>
					<div class="session-info">
						{#if editingId === session.id}
							<!-- svelte-ignore a11y_autofocus -->
							<input
								class="session-title-input"
								type="text"
								bind:value={editTitle}
								onblur={() => saveEdit(session.id)}
								onkeydown={(e) => handleEditKeydown(e, session.id)}
								onclick={(e: MouseEvent) => e.stopPropagation()}
								autofocus
							/>
						{:else}
							<div
								class="session-title"
								ondblclick={() => startEdit(session)}
								onkeydown={() => {}}
								role="textbox"
								tabindex="-1"
							>
								{session.title}
							</div>
							<div class="session-time">{formatTime(session.updated_at)}</div>
						{/if}
					</div>
					<button
						class="delete-btn"
						onclick={(e: MouseEvent) => { e.stopPropagation(); handleDelete(session.id); }}
						title="删除"
					>
						<span class="material-symbols-rounded">delete</span>
					</button>
				</div>
			{/each}
		</div>

		<div class="sidebar-footer">
			<a href="/settings" class="footer-link" class:active={$page.url.pathname === '/settings'}>
				<span class="material-symbols-rounded">settings</span>
				设置
			</a>
		</div>
</div>

<style>
	.sidebar {
		position: fixed;
		top: 0;
		left: 0;
		bottom: 0;
		width: 280px;
		background: #F3F0E9;
		border-right: 1px solid rgba(215, 210, 200, 0.4);
		display: flex;
		flex-direction: column;
		transition: transform 0.3s cubic-bezier(0.2, 0, 0, 1);
		overflow: hidden;
		height: 100%;
		z-index: 50;
		transform: translateX(-100%);
		box-shadow: none;
	}

	.sidebar.mobile-open {
		transform: translateX(0);
		box-shadow: 2px 0 12px rgba(74, 69, 66, 0.15);
	}

	.sidebar-header {
		display: flex;
		align-items: center;
		padding: 0.85rem;
		height: 60px;
		box-sizing: border-box;
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding-left: 0;
		text-decoration: none;
	}

	.brand-icon {
		font-size: 24px;
		color: #7B8C7C;
	}

	.brand-name {
		font-weight: 500;
		font-size: 1.15rem;
		color: #4A4542;
		letter-spacing: 0.02em;
	}

	.section-label {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem 1rem 0.25rem 1.15rem;
		font-size: 0.75rem;
		font-weight: 600;
		color: #A6A098;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.new-btn {
		width: 30px;
		height: 30px;
		border: none;
		border-radius: 8px;
		background: transparent;
		color: #A6A098;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 0.2s, color 0.2s;
	}

	.new-btn:hover {
		background: #E8E4DB;
		color: #4A4542;
	}

	.session-list {
		flex: 1;
		overflow-y: auto;
		padding: 0.5rem 0.75rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.session-list::-webkit-scrollbar {
		display: none;
	}

	.session-item {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.65rem 0.85rem;
		border-radius: 12px;
		cursor: pointer;
		transition: background 0.2s;
		font-size: 0.95rem;
		color: #4A4542;
	}

	.session-item:hover {
		background: #EAE6DD;
	}

	.session-item.active {
		background: #DFD9CE;
	}

	.session-icon {
		font-size: 18px;
		color: #A6A098;
		flex-shrink: 0;
	}

	.session-item.active .session-icon {
		color: #7B8C7C;
	}

	.session-info {
		flex: 1;
		min-width: 0;
	}

	.session-title {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		font-size: 0.92rem;
	}

	.session-title-input {
		width: 100%;
		padding: 0.2rem 0.4rem;
		border: 1px solid #7B8C7C;
		border-radius: 6px;
		background: #FFFFFF;
		font-family: inherit;
		font-size: 0.92rem;
		color: #4A4542;
		outline: none;
		box-sizing: border-box;
	}

	.session-time {
		font-size: 0.75rem;
		color: #A6A098;
		margin-top: 0.15rem;
	}

	.delete-btn {
		width: 28px;
		height: 28px;
		border: none;
		border-radius: 6px;
		background: transparent;
		color: #A6A098;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		opacity: 0;
		transition: opacity 0.2s, background 0.2s, color 0.2s;
	}

	.session-item:hover .delete-btn {
		opacity: 1;
	}

	.delete-btn:hover {
		background: #FCE8E6;
		color: #D32F2F;
	}

	.sidebar-footer {
		padding: 0.75rem;
		border-top: 1px solid rgba(215, 210, 200, 0.4);
	}

	.footer-link {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		border-radius: 12px;
		color: #8E857D;
		text-decoration: none;
		font-size: 0.9rem;
		transition: background 0.2s, color 0.2s;
	}

	.footer-link:hover, .footer-link.active {
		background: #EAE6DD;
		color: #4A4542;
	}
</style>
