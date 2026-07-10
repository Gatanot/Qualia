<script lang="ts">
	let dates = $state<string[]>([]);
	let selectedDate = $state<string | null>(null);
	let diaryHtml = $state('');
	let diaryRaw = $state('');
	let loading = $state(true);
	let contentLoading = $state(false);

	$effect(() => {
		loadDates();
	});

	async function loadDates() {
		loading = true;
		try {
			const res = await fetch('/api/diary');
			if (res.ok) {
				const data = await res.json();
				dates = data.dates || [];
				if (dates.length > 0) {
					selectedDate = dates[0];
					await loadDiary(dates[0]);
				}
			}
		} finally {
			loading = false;
		}
	}

	async function loadDiary(date: string) {
		contentLoading = true;
		selectedDate = date;
		try {
			const res = await fetch(`/api/diary?date=${date}`);
			if (res.ok) {
				const data = await res.json();
				diaryHtml = data.html;
				diaryRaw = data.content;
			} else {
				diaryHtml = '';
				diaryRaw = '';
			}
		} finally {
			contentLoading = false;
		}
	}

	function fmtWeekday(dateStr: string): string {
		const [y, m, d] = dateStr.split('-').map(Number);
		const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
		return weekdays[new Date(y, m - 1, d).getDay()];
	}
</script>

<div class="diary-page">
	<div class="sidebar">
		<h2>日记列表</h2>
		{#if loading}
			<div class="loading">加载中...</div>
		{:else if dates.length === 0}
			<div class="empty">暂无日记</div>
		{:else}
			<ul class="date-list">
				{#each dates as d}
					<li class:active={d === selectedDate}>
						<button onclick={() => loadDiary(d)}>
							<span class="date-text">{d}</span>
							<span class="weekday">{fmtWeekday(d)}</span>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<div class="content">
		{#if !selectedDate}
			<div class="placeholder">选择日期查看日记</div>
		{:else if contentLoading}
			<div class="loading">加载中...</div>
		{:else if !diaryHtml}
			<div class="empty">该日暂无日记内容</div>
		{:else}
			<div class="diary-entry">
				<h1>{selectedDate} {fmtWeekday(selectedDate)}</h1>
				<div class="markdown-body">
					{@html diaryHtml}
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.diary-page {
		display: flex;
		height: calc(100vh - var(--header-height, 0px));
		max-width: 1100px;
		margin: 0 auto;
	}

	.sidebar {
		width: 260px;
		flex-shrink: 0;
		border-right: 1px solid var(--border);
		padding: var(--space-lg);
		overflow-y: auto;
	}

	.sidebar h2 {
		font-size: 1.1rem;
		margin-bottom: var(--space-md);
	}

	.date-list {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.date-list button {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		width: 100%;
		padding: var(--space-sm) var(--space-md);
		border: none;
		background: none;
		cursor: pointer;
		border-radius: var(--radius-md);
		text-align: left;
		color: var(--text);
	}

	.date-list button:hover {
		background: var(--bg-hover);
	}

	.date-list .active button {
		background: var(--accent);
		color: var(--on-accent);
	}

	.date-list .date-text {
		font-family: var(--font-mono);
		font-size: 0.85rem;
	}

	.date-list .weekday {
		font-size: 0.75rem;
		opacity: 0.7;
	}

	.content {
		flex: 1;
		padding: var(--space-xl);
		overflow-y: auto;
	}

	.diary-entry h1 {
		font-size: 1.3rem;
		margin-bottom: var(--space-xl);
		padding-bottom: var(--space-sm);
		border-bottom: 1px solid var(--border);
	}

	.markdown-body {
		line-height: 1.8;
	}

	.placeholder, .loading, .empty {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 200px;
		color: var(--text-muted);
	}
</style>
