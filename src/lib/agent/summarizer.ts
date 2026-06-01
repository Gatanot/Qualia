import type { AIProvider, Message } from '$lib/provider';
import type { Storage } from '$lib/storage';

export async function generateSummary(
	provider: AIProvider,
	storage: Storage,
	sessionId: string,
	existingSummary?: string
): Promise<string> {
	const records = await storage.getMessages(sessionId);
	if (records.length === 0) return '';

	const messages: Message[] = records.map((r) => ({
		role: r.role,
		content: r.content
	}));

	let userInstruction = '请总结以上对话，用中文、简洁，以时间线形式逐条记录关键决策、修改的文件和重要结论。';
	if (existingSummary) {
		userInstruction += `\n\n以下是已有摘要，请在此基础上更新（保留已有信息并追加新内容）：\n${existingSummary}`;
	}

	messages.push({ role: 'user', content: userInstruction });

	const response = await provider.chat({
		messages,
		max_tokens: 2000,
		temperature: 0.3
	});

	return response.content || '';
}
