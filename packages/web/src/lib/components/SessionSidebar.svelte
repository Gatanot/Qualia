<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { sessions, setSessionTitle, deleteSession, activeWorkspace } from '$lib/session-store';
	import type { Session } from '@gatanot/qualia_core/storage';
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
	let pickerOpen = $state(false);
	let pickerPath = $state('');
	let pickerEntries = $state<{ name: string; isDirectory: boolean }[]>([]);
	let pickerParent = $state('');
	let collapsedGroups = $state(new Set<string>());
	let workspaceMenuOpen = $state(false);

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

	async function openPicker() {
		workspaceMenuOpen = !workspaceMenuOpen;
	}

	async function openAddWorkspace() {
		workspaceMenuOpen = false;
		pickerOpen = true;
		await browsePath('');
	}

	async function browsePath(path: string) {
		const res = await fetch('/api/browse', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ path })
		});
		if (res.ok) {
			const data = await res.json();
			pickerPath = data.path;
			pickerEntries = data.entries;
			pickerParent = data.parent;
		}
	}

	function selectWorkspace(ws: string) {
		activeWorkspace.set(ws);
		workspaceMenuOpen = false;
	}

	function confirmPicker() {
		activeWorkspace.set(pickerPath);
		pickerOpen = false;
	}

	function toggleGroup(ws: string) {
		if (collapsedGroups.has(ws)) {
			collapsedGroups.delete(ws);
		} else {
			collapsedGroups.add(ws);
		}
		collapsedGroups = new Set(collapsedGroups);
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

	function wsLabel(ws: string): string {
		if (!ws) return '默认工作区';
		const parts = ws.replace(/\\/g, '/').split('/');
		return parts[parts.length - 1] || ws;
	}

	let groups = $derived.by(() => {
		const map = new Map<string, Session[]>();
		for (const s of $sessions) {
			const key = s.workspace || '';
			if (!map.has(key)) map.set(key, []);
			map.get(key)!.push(s);
		}
		const result = Array.from(map.entries())
			.map(([ws, items]) => ({ workspace: ws, sessions: items }))
			.sort((a, b) => {
				if (!a.workspace) return -1;
				if (!b.workspace) return 1;
				return a.workspace.localeCompare(b.workspace);
			});
		return result;
	});
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
		<button class="collapse-btn" onclick={() => (mobileOpen = false)} title="收起侧边栏">
			<span class="material-symbols-rounded">menu_open</span>
		</button>
	</div>

	<div class="workspace-bar">
		<button class="ws-selector" onclick={openPicker}>
			<span class="material-symbols-rounded ws-icon">folder</span>
			<span class="ws-label">{wsLabel($activeWorkspace)}</span>
			<span class="material-symbols-rounded ws-arrow">expand_more</span>
		</button>
		{#if workspaceMenuOpen}
			<div class="ws-menu">
				<button class="ws-option" class:active={!$activeWorkspace} onclick={() => selectWorkspace('')}>
					<span class="material-symbols-rounded">computer</span>
					<span>默认工作区</span>
				</button>
				{#each groups as group (group.workspace)}
					{#if group.workspace}
						<button class="ws-option" class:active={$activeWorkspace === group.workspace} onclick={() => selectWorkspace(group.workspace)}>
							<span class="material-symbols-rounded">folder</span>
							<span title={group.workspace}>{wsLabel(group.workspace)}</span>
						</button>
					{/if}
				{/each}
				<div class="ws-separator"></div>
				<button class="ws-option ws-add-btn" onclick={openAddWorkspace}>
					<span class="material-symbols-rounded">create_new_folder</span>
					<span>添加工作区...</span>
				</button>
			</div>
		{/if}
	</div>

	<div class="section-label">
		<span>对话</span>
		<a href="/memory" class="memory-link" class:active={$page.url.pathname === '/memory'}>
			<span class="material-symbols-rounded">book_4</span>
			<span class="memory-text">记忆</span>
		</a>
		<button class="new-btn" onclick={handleNew}>
			<span class="material-symbols-rounded">add</span>
		</button>
	</div>

	<div class="session-list">
		{#each groups as group (group.workspace)}
			{@const isCollapsed = collapsedGroups.has(group.workspace)}
			<button class="group-header" onclick={() => toggleGroup(group.workspace)}>
				<span class="material-symbols-rounded group-arrow">
					{isCollapsed ? 'chevron_right' : 'expand_more'}
				</span>
				<span class="material-symbols-rounded group-icon">folder</span>
				<span class="group-name">{wsLabel(group.workspace)}</span>
				<span class="group-count">{group.sessions.length}</span>
			</button>
			{#if !isCollapsed}
				{#each group.sessions.slice(0, 8) as session (session.id)}
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
			{/if}
		{/each}
		<a href="/records" class="view-all-link">
			<span class="material-symbols-rounded view-all-icon">history</span>
			<span class="view-all-text">查看全部记录</span>
		</a>
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

{#if pickerOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions a11y_interactive_supports_focus -->
	<div class="picker-overlay" role="presentation" onclick={() => (pickerOpen = false)}>
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions a11y_no_noninteractive_element_interactions -->
		<div class="picker-dialog" role="dialog" tabindex="-1" onclick={(e: MouseEvent) => e.stopPropagation()}>
			<div class="picker-header">
				<span class="material-symbols-rounded">folder_open</span>
				<span class="picker-path">{pickerPath}</span>
			</div>
			<div class="picker-list">
				{#if pickerParent !== pickerPath}
					<button class="picker-entry" onclick={() => browsePath(pickerParent)}>
						<span class="material-symbols-rounded">arrow_upward</span>
						<span>..</span>
					</button>
				{/if}
				{#each pickerEntries as entry}
					<button class="picker-entry" onclick={() => browsePath(pickerPath + (pickerPath.endsWith('/') || pickerPath.endsWith('\\') ? '' : '/') + entry.name)}>
						<span class="material-symbols-rounded">folder</span>
						<span>{entry.name}</span>
					</button>
				{/each}
			</div>
			<div class="picker-actions">
				<button class="picker-btn secondary" onclick={() => (pickerOpen = false)}>取消</button>
				<button class="picker-btn primary" onclick={confirmPicker}>选择此文件夹</button>
			</div>
		</div>
	</div>
{/if}

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

	.collapse-btn {
		margin-left: auto;
		width: 32px;
		height: 32px;
		border: none;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		transition: background 0.2s var(--ease-out), color 0.2s var(--ease-out);
	}

	.collapse-btn:hover {
		background: var(--bg-surface-press);
		color: var(--text-primary);
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

	.workspace-bar {
		padding: 0 0.75rem 0.5rem;
		position: relative;
	}

	.ws-selector {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.55rem 0.75rem;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		background: var(--bg-surface);
		color: var(--text-primary);
		cursor: pointer;
		font-family: inherit;
		font-size: 0.85rem;
		transition: border-color 0.2s var(--ease-out), background 0.2s var(--ease-out);
	}

	.ws-selector:hover {
		border-color: var(--accent);
		background: var(--bg-surface-active);
	}

	.ws-icon {
		font-size: 18px;
		color: var(--accent);
		flex-shrink: 0;
	}

	.ws-label {
		flex: 1;
		text-align: left;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.ws-arrow {
		font-size: 18px;
		color: var(--text-muted);
		flex-shrink: 0;
	}

	.ws-menu {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		background: var(--bg-surface);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-sidebar);
		z-index: 60;
		max-height: 260px;
		overflow-y: auto;
		padding: 0.3rem;
		margin-top: 2px;
	}

	.ws-option {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.5rem 0.6rem;
		border: none;
		border-radius: 6px;
		background: transparent;
		color: var(--text-primary);
		cursor: pointer;
		font-family: inherit;
		font-size: 0.82rem;
		text-align: left;
		transition: background 0.15s var(--ease-out);
	}

	.ws-option:hover, .ws-option.active {
		background: var(--bg-surface-active);
	}

	.ws-option .material-symbols-rounded {
		font-size: 16px;
		color: var(--text-muted);
		flex-shrink: 0;
	}

	.ws-option.active .material-symbols-rounded {
		color: var(--accent);
	}

	.ws-separator {
		height: 1px;
		background: var(--border-subtle);
		margin: 0.3rem 0.5rem;
	}

	.ws-add-btn {
		color: var(--accent);
		font-weight: 500;
	}

	.ws-add-btn .material-symbols-rounded {
		color: var(--accent);
	}

	.section-label {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.5rem 1rem 0.25rem;
		font-size: 0.72rem;
		font-weight: 600;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.section-label > span:first-child {
		margin-right: auto;
	}

	.memory-link {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		text-decoration: none;
		color: var(--text-muted);
		font-size: 0.72rem;
		font-weight: 500;
		padding: 0.15rem 0.4rem;
		border-radius: var(--radius-sm);
		transition: background 0.2s var(--ease-out), color 0.2s var(--ease-out);
		text-transform: none;
		letter-spacing: 0.02em;
	}

	.memory-link:hover, .memory-link.active {
		background: var(--bg-surface-active);
		color: var(--text-primary);
	}

	.memory-link.active {
		background: var(--bg-surface-press);
		color: var(--accent);
	}

	.memory-link .material-symbols-rounded {
		font-size: 16px;
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
		gap: 2px;
	}

	.session-list::-webkit-scrollbar {
		width: 4px;
	}
	.session-list::-webkit-scrollbar-thumb {
		background-color: var(--scrollbar);
		border-radius: 10px;
	}

	.group-header {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.4rem 0.5rem;
		margin-top: 4px;
		border: none;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
		font-family: inherit;
		font-size: 0.75rem;
		font-weight: 600;
		text-align: left;
		transition: background 0.15s var(--ease-out), color 0.15s var(--ease-out);
	}

	.group-header:hover {
		background: var(--bg-surface-active);
		color: var(--text-primary);
	}

	.group-arrow {
		font-size: 16px;
		flex-shrink: 0;
	}

	.group-icon {
		font-size: 15px;
		flex-shrink: 0;
		color: var(--accent);
	}

	.group-name {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.group-count {
		font-size: 0.68rem;
		background: var(--bg-surface-press);
		padding: 0.1rem 0.4rem;
		border-radius: var(--radius-full);
		color: var(--text-muted);
	}

	.session-item {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.65rem 0.75rem 0.65rem 1.85rem;
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
		font-size: 0.88rem;
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
		font-size: 0.88rem;
		color: var(--text-primary);
		outline: none;
		box-sizing: border-box;
	}

	.session-time {
		font-size: 0.7rem;
		color: var(--text-muted);
		margin-top: 0.15rem;
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

	.view-all-link {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.7rem 0.85rem;
		border-radius: var(--radius-md);
		text-decoration: none;
		color: var(--text-muted);
		font-size: 0.9rem;
		transition: background 0.2s var(--ease-out), color 0.2s var(--ease-out);
		margin-top: 4px;
	}

	.view-all-link:hover {
		background: var(--bg-surface-active);
		color: var(--text-primary);
	}

	.view-all-icon {
		font-size: 18px;
	}

	.sidebar-footer {
		display: flex;
		gap: 0.5rem;
		padding: 0.75rem 0.75rem 0.85rem;
		border-top: 1px solid var(--border-subtle);
	}

	.footer-link {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.55rem 0;
		border-radius: var(--radius-md);
		color: var(--text-secondary);
		text-decoration: none;
		font-size: 0.88rem;
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

	/* Folder picker overlay */
	.picker-overlay {
		position: fixed;
		inset: 0;
		background: var(--overlay);
		z-index: 100;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.picker-dialog {
		background: var(--bg-surface);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-sidebar);
		width: 420px;
		max-height: 480px;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.picker-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.85rem 1rem;
		border-bottom: 1px solid var(--border-subtle);
		font-size: 0.85rem;
		color: var(--text-primary);
	}

	.picker-header .material-symbols-rounded {
		color: var(--accent);
		font-size: 20px;
	}

	.picker-path {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-family: var(--font-mono, monospace);
		font-size: 0.78rem;
	}

	.picker-list {
		flex: 1;
		overflow-y: auto;
		padding: 0.4rem;
		max-height: 340px;
	}

	.picker-entry {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.5rem 0.75rem;
		border: none;
		border-radius: 6px;
		background: transparent;
		color: var(--text-primary);
		cursor: pointer;
		font-family: inherit;
		font-size: 0.85rem;
		transition: background 0.15s var(--ease-out);
	}

	.picker-entry:hover {
		background: var(--bg-surface-active);
	}

	.picker-entry .material-symbols-rounded {
		font-size: 18px;
		color: var(--accent);
	}

	.picker-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		border-top: 1px solid var(--border-subtle);
	}

	.picker-btn {
		padding: 0.5rem 1rem;
		border: none;
		border-radius: var(--radius-md);
		cursor: pointer;
		font-family: inherit;
		font-size: 0.85rem;
		transition: background 0.2s var(--ease-out);
	}

	.picker-btn.secondary {
		background: transparent;
		color: var(--text-secondary);
	}

	.picker-btn.secondary:hover {
		background: var(--bg-surface-active);
	}

	.picker-btn.primary {
		background: var(--accent);
		color: var(--text-on-accent);
	}

	.picker-btn.primary:hover {
		background: var(--accent-hover);
	}
</style>
