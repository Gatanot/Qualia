import type { AIProvider, Message } from '$lib/provider';
import type { Storage } from '$lib/storage';
import { buildSystemMessage, completeWithToolLoop } from './summarizer';

function getTodayFile(): string {
	const now = new Date();
	let date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	if (now.getHours() < 8) {
		date = new Date(date.getTime() - 86_400_000);
	}
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, '0');
	const d = String(date.getDate()).padStart(2, '0');
	return `data/diary/${y}-${m}-${d}.md`;
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

	const filePath = getTodayFile();

	const messages: Message[] = [
		buildSystemMessage(),
		{
			role: 'user',
			content: `以下是今天各会话的摘要，请据此撰写一篇日记，记录当天和我一起完成了什么、有哪些重要交流。\n\n${summaries.join('\n\n')}\n\n请使用 write_file 工具将日记写入以下文件：${filePath}`
		}
	];

	await completeWithToolLoop(provider, messages, 2000, 0.5);
}
