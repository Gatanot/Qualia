import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { AIProvider, Message } from '$lib/provider';
import type { Storage } from '$lib/storage';

const DIARY_DIR = join(process.cwd(), 'data', 'diary');

function getTodayFile(): string {
	const today = new Date();
	const y = today.getFullYear();
	const m = String(today.getMonth() + 1).padStart(2, '0');
	const d = String(today.getDate()).padStart(2, '0');
	return join(DIARY_DIR, `${y}-${m}-${d}.md`);
}

function ensureDiaryDir(): void {
	if (!existsSync(DIARY_DIR)) {
		mkdirSync(DIARY_DIR, { recursive: true });
	}
}

const DIARY_SYSTEM_PROMPT = `你是一个日记助手。你的任务是根据当天的会话摘要，撰写一篇简洁的日记条目。

要求：
1. 用中文，亲切自然
2. 记录当天和用户一起完成了什么、有哪些重要交流
3. 不要流水账式罗列，而是提炼出有意义的片段
4. 格式：## YYYY年MM月DD日`;

export async function generateDiary(
	provider: AIProvider,
	storage: Storage
): Promise<void> {
	const sessions = await storage.getTodayUpdatedSessions();
	if (sessions.length === 0) return;

	const summaries: string[] = [];
	for (const s of sessions) {
		if (s.summary) {
			summaries.push(`### ${s.title}\n${s.summary}`);
		}
	}
	if (summaries.length === 0) return;

	const messages: Message[] = [
		{ role: 'system', content: DIARY_SYSTEM_PROMPT },
		{
			role: 'user',
			content: `以下是今天各会话的摘要，请据此撰写日记：\n\n${summaries.join('\n\n')}`
		}
	];

	const response = await provider.chat({
		messages,
		max_tokens: 2000,
		temperature: 0.5
	});

	const diaryContent = response.content;
	if (!diaryContent) return;

	ensureDiaryDir();
	const filePath = getTodayFile();
	writeFileSync(filePath, diaryContent + '\n', 'utf-8');
}
