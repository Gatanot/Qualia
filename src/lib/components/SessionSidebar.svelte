<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { sessions, setSessionTitle, deleteSession } from '$lib/session-store';
	import type { Session } from '$lib/storage';
	import SearchDialog from './SearchDialog.svelte';
	import { getTheme, toggleTheme } from '$lib/theme';

	let { mobileOpen = $bindable(false), customIcon = false }: {
		mobileOpen: boolean;
		customIcon?: boolean;
	} = $props();

	let editingId = $state<string | null>(null);
	let editTitle = $state('');
	let searchOpen = $state(false);
	let themeIcon = $state(getTheme() === 'dark' ? 'light_mode' : 'dark_mode');

	import { afterNavigate } from '$app/navigation';

	afterNavigate(() => {
		mobileOpen = false;
	});

	function handleSelect(session: Session) {
		goto('/chat/' + session.id);
	}

	function handleNew() {
		goto('/');
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

	function handleToggleTheme() {
		toggleTheme();
		themeIcon = getTheme() === 'dark' ? 'light_mode' : 'dark_mode';
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
			{#if customIcon}
				<img src="/api/brand-icon" alt="" class="brand-img" />
			{:else}
				<span class="material-symbols-rounded brand-icon">spa</span>
			{/if}
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
			<button class="footer-link search-btn" onclick={() => (searchOpen = true)}>
				<span class="material-symbols-rounded">search</span>
				搜索
			</button>
			<button class="footer-link theme-btn" onclick={handleToggleTheme} title="切换主题">
				<span class="material-symbols-rounded">{themeIcon}</span>
			</button>
		</div>
</div>

<SearchDialog sessions={$sessions} bind:open={searchOpen} />

<style>
	.sidebar {
		position: fixed;
		top: 0;
		left: 0;
		bottom: 0;
		width: 280px;
		background: var(--bg-sidebar);
		border-right: 1px solid var(--border-subtle);
		display: flex;
		flex-direction: column;
		transition: transform 0.35s var(--ease-out);
		overflow: hidden;
		height: 100%;
		z-index: 50;
		transform: translateX(-100%);
		box-shadow: none;
	}

	.sidebar.mobile-open {
		transform: translateX(0);
		box-shadow: var(--shadow-sidebar);
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
		transition: opacity 0.2s var(--ease-out);
	}

	.brand:hover {
		opacity: 0.8;
	}

	.brand-icon {
		font-size: 24px;
		color: var(--accent);
	}

	.brand-img {
		width: 28px;
		height: 28px;
		border-radius: var(--radius-full);
		object-fit: cover;
	}

	.brand-name {
		font-weight: 700;
		font-family: var(--font-serif);
		font-size: var(--text-xl);
		color: var(--text-primary);
		letter-spacing: 0.03em;
	}

	.section-label {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem 1rem 0.25rem 1.15rem;
		font-size: 0.72rem;
		font-weight: 600;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.new-btn {
		width: 30px;
		height: 30px;
		border: none;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 0.2s var(--ease-out), color 0.2s var(--ease-out), transform 0.15s var(--ease-out);
	}

	.new-btn:hover {
		background: var(--bg-surface-press);
		color: var(--text-primary);
		transform: scale(1.1);
	}

	.new-btn:active {
		transform: scale(0.95);
	}

	.session-list {
		flex: 1;
		overflow-y: auto;
		padding: 0.5rem 0.75rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.session-list::-webkit-scrollbar {
		width: 4px;
	}
	.session-list::-webkit-scrollbar-thumb {
		background-color: var(--scrollbar);
		border-radius: 10px;
	}

	.session-item {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.7rem 0.85rem;
		border-radius: var(--radius-md);
		cursor: pointer;
		transition: background 0.2s var(--ease-out), transform 0.15s var(--ease-out);
		font-size: var(--text-base);
		color: var(--text-primary);
	}

	.session-item:hover {
		background: var(--bg-surface-active);
	}

	.session-item:active {
		transform: scale(0.985);
	}

	.session-item.active {
		background: var(--bg-surface-press);
	}

	.session-icon {
		font-size: 18px;
		color: var(--text-muted);
		flex-shrink: 0;
		transition: color 0.2s var(--ease-out);
	}

	.session-item.active .session-icon {
		color: var(--accent);
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
		font-weight: 400;
	}

	.session-item.active .session-title {
		font-weight: 500;
	}

	.session-title-input {
		width: 100%;
		padding: 0.2rem 0.4rem;
		border: 1px solid var(--accent);
		border-radius: 6px;
		background: var(--bg-surface);
		font-family: inherit;
		font-size: 0.92rem;
		color: var(--text-primary);
		outline: none;
		box-sizing: border-box;
	}

	.session-time {
		font-size: 0.72rem;
		color: var(--text-muted);
		margin-top: 0.2rem;
		font-weight: 400;
	}

	.delete-btn {
		width: 28px;
		height: 28px;
		border: none;
		border-radius: 6px;
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		opacity: 0;
		transition: opacity 0.2s var(--ease-out), background 0.2s var(--ease-out), color 0.2s var(--ease-out), transform 0.15s var(--ease-out);
	}

	.session-item:hover .delete-btn {
		opacity: 1;
	}

	.delete-btn:hover {
		background: var(--danger-bg);
		color: var(--danger-btn);
		transform: scale(1.1);
	}

	.delete-btn:active {
		transform: scale(0.9);
	}

	.sidebar-footer {
		display: flex;
		gap: 0.25rem;
		padding: 0.75rem;
		border-top: 1px solid var(--border-subtle);
	}

	.footer-link {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		border-radius: var(--radius-md);
		color: var(--text-secondary);
		text-decoration: none;
		font-size: 0.9rem;
		transition: background 0.2s var(--ease-out), color 0.2s var(--ease-out);
	}

	.search-btn, .theme-btn {
		background: none;
		border: none;
		cursor: pointer;
		font-family: inherit;
	}

	.footer-link:hover, .footer-link.active {
		background: var(--bg-surface-active);
		color: var(--text-primary);
	}
</style>
