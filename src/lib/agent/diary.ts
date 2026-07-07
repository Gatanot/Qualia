import { existsSync, readFileSync } from 'node:fs';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { AIProvider, Message } from '$lib/ai';
import type { Storage } from '$lib/storage';
import { buildSystemMessage, completeWithToolLoop } from './summarizer';
import { getDataDir, getDataPath } from '$lib/paths';
import { ToolContext } from '$lib/tool';

const DIARY_DIR = join(getDataPath('diary'));
const MAX_RECENT_DAYS = 7;

function getTodayDate(): { date: Date; y: number; m: string; d: string } {
	const now = new Date();
	let date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	if (now.getHours() < 8) {
		date = new Date(date.getTime() - 86_400_000);
	}
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, '0');
	const d = String(date.getDate()).padStart(2, '0');
	return { date, y, m, d };
}

function formatDatePath(y: number, m: string, d: string): string {
	return join(DIARY_DIR, `${y}-${m}-${d}.md`);
}

function getTodayFile(): string {
	const { y, m, d } = getTodayDate();
	return formatDatePath(y, m, d);
}

function readRecentDiaries(targetDate: Date): string {
	const parts: string[] = [];
	const cursor = new Date(targetDate);

	for (let i = 1; i <= MAX_RECENT_DAYS; i++) {
		cursor.setDate(cursor.getDate() - 1);
		const y = cursor.getFullYear();
		const m = String(cursor.getMonth() + 1).padStart(2, '0');
		const d = String(cursor.getDate()).padStart(2, '0');
		const filePath = join(DIARY_DIR, `${y}-${m}-${d}.md`);
		if (existsSync(filePath)) {
			const content = readFileSync(filePath, 'utf-8').trim();
			parts.push(`### ${y}-${m}-${d}\n${content.slice(0, 2000)}`);
		}
	}

	return parts.join('\n\n');
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

	const { date } = getTodayDate();
	const filePath = getTodayFile();
	const recentDiaries = readRecentDiaries(date);

	let userContent = `以下是今天各会话的摘要，请据此撰写一篇日记，记录当天和我一起完成了什么、有哪些重要交流。\n\n${summaries.join('\n\n')}`;

	if (recentDiaries) {
		userContent += `\n\n以下是前几天的日记内容，请参考以保持日记的连贯性和叙事感：\n\n${recentDiaries}`;
	}

	userContent += `\n\n请使用 write_file 工具将日记写入以下文件：${filePath}`;

	const messages: Message[] = [
		buildSystemMessage(),
		{ role: 'user', content: userContent }
	];

	const before = readDiaryContent(filePath);
	const toolContext = new ToolContext(getDataDir());
	const { content } = await completeWithToolLoop(provider, messages, 2000, 0.5, toolContext);

	const after = readDiaryContent(filePath);
	if (after !== null && after !== before) return;

	const fallback = (content || '').trim();
	if (!fallback) {
		throw new Error('日记生成失败：模型未写入文件且未返回内容');
	}
	await mkdir(DIARY_DIR, { recursive: true });
	await writeFile(filePath, fallback, 'utf-8');
}

function readDiaryContent(filePath: string): string | null {
	try {
		return existsSync(filePath) ? readFileSync(filePath, 'utf-8').trim() : null;
	} catch {
		return null;
	}
}
