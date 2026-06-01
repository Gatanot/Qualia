import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { AIProvider, Message } from '$lib/provider';
import type { Storage } from '$lib/storage';
import { buildSystemMessage, _toolDefs } from './summarizer';

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
		buildSystemMessage(),
		{
			role: 'user',
			content: `以下是今天各会话的摘要，请据此撰写一篇日记，记录当天和我一起完成了什么、有哪些重要交流。\n\n${summaries.join('\n\n')}`
		}
	];

	const response = await provider.chat({
		messages,
		tools: _toolDefs,
		max_tokens: 2000,
		temperature: 0.5
	});

	const diaryContent = response.content;
	if (!diaryContent) return;

	ensureDiaryDir();
	const filePath = getTodayFile();
	writeFileSync(filePath, diaryContent + '\n', 'utf-8');
}
