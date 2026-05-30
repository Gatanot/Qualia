<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { sessions, activeId, setActive, createSession, setSessionTitle, deleteSession } from '$lib/session-store';
	import type { Session } from '$lib/storage';

	let collapsed = $state(false);
	let editingId = $state<string | null>(null);
	let editTitle = $state('');

	function handleSelect(session: Session) {
		setActive(session.id);
		if ($page.url.pathname !== '/') goto('/');
	}

	async function handleNew() {
		await createSession();
		if ($page.url.pathname !== '/') goto('/');
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

<div class="sidebar" class:collapsed>
	<div class="sidebar-header">
		<button class="hamburger" onclick={() => (collapsed = !collapsed)}>
			<span class="material-symbols-rounded">menu</span>
		</button>
		{#if !collapsed}
			<a href="/" class="brand">
				<span class="material-symbols-rounded brand-icon">spa</span>
				<span class="brand-name">Qualia</span>
			</a>
		{/if}
	</div>

	{#if !collapsed}
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
					class:active={session.id === $activeId}
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
								{session.title || '新对话'}
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
	{/if}
</div>

<style>
	.sidebar {
		width: 260px;
		flex-shrink: 0;
		background: #F5F2EB;
		border-right: 1px solid rgba(230, 226, 216, 0.6);
		display: flex;
		flex-direction: column;
		transition: width 0.2s ease;
		overflow: hidden;
		height: 100%;
	}

	.sidebar.collapsed {
		width: 52px;
	}

	.sidebar-header {
		display: flex;
		align-items: center;
		padding: 0.75rem;
		height: 52px;
		box-sizing: border-box;
	}

	.hamburger {
		width: 36px;
		height: 36px;
		border: none;
		border-radius: 8px;
		background: transparent;
		color: #706862;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		transition: background 0.15s;
	}

	.hamburger:hover {
		background: #E8E3D9;
	}

	.hamburger .material-symbols-rounded {
		font-size: 20px;
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding-left: 0.5rem;
		text-decoration: none;
	}

	.brand-icon {
		font-size: 22px;
		color: #6B7F72;
	}

	.brand-name {
		font-weight: 500;
		font-size: 1.1rem;
		color: #3D3834;
	}

	.section-label {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.25rem 0.75rem 0.25rem 1rem;
		font-size: 0.75rem;
		font-weight: 500;
		color: #A39B93;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.new-btn {
		width: 28px;
		height: 28px;
		border: none;
		border-radius: 6px;
		background: transparent;
		color: #A39B93;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 0.15s;
	}

	.new-btn:hover {
		background: #E8E3D9;
		color: #3D3834;
	}

	.new-btn .material-symbols-rounded {
		font-size: 18px;
	}

	.session-list {
		flex: 1;
		overflow-y: auto;
		padding: 0.5rem 0.5rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.session-list::-webkit-scrollbar {
		display: none;
	}

	.session-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.6rem 0.75rem;
		border-radius: 12px;
		cursor: pointer;
		transition: background 0.12s;
		font-size: 0.9rem;
		color: #3D3834;
	}

	.session-item:hover {
		background: #EBE6D9;
	}

	.session-item.active {
		background: #E3DDD0;
	}

	.session-icon {
		font-size: 18px;
		color: #A39B93;
		flex-shrink: 0;
	}

	.session-item.active .session-icon {
		color: #5E7163;
	}

	.session-info {
		flex: 1;
		min-width: 0;
	}

	.session-title {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		font-size: 0.88rem;
	}

	.session-title-input {
		width: 100%;
		padding: 0.2rem 0.4rem;
		border: 1px solid #5E7163;
		border-radius: 6px;
		background: #FFFFFF;
		font-family: inherit;
		font-size: 0.88rem;
		color: #3D3834;
		outline: none;
		box-sizing: border-box;
	}

	.session-time {
		font-size: 0.75rem;
		color: #A39B93;
		margin-top: 0.15rem;
	}

	.delete-btn {
		width: 28px;
		height: 28px;
		border: none;
		border-radius: 6px;
		background: transparent;
		color: #A39B93;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		opacity: 0;
		transition: opacity 0.12s, background 0.12s, color 0.12s;
	}

	.session-item:hover .delete-btn {
		opacity: 1;
	}

	.delete-btn:hover {
		background: #FCE8E6;
		color: #D32F2F;
	}

	.delete-btn .material-symbols-rounded {
		font-size: 16px;
	}

	.sidebar-footer {
		padding: 0.75rem;
		border-top: 1px solid rgba(230, 226, 216, 0.5);
	}

	.footer-link {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		border-radius: 12px;
		color: #706862;
		text-decoration: none;
		font-size: 0.9rem;
		transition: background 0.12s, color 0.12s;
	}

	.footer-link:hover, .footer-link.active {
		background: #E3DDD0;
		color: #3D3834;
	}

	.footer-link .material-symbols-rounded {
		font-size: 20px;
	}
</style>
