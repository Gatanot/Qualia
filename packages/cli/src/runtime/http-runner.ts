import { randomUUID } from 'node:crypto';
import type { AgentEvent, ConfirmFn } from '@gatanot/qualia_core/agent';
import { CliError } from '../errors.js';

export interface AgentRunOptions {
	workspace: string;
	message: string;
	sessionId?: string;
	newSession?: boolean;
	modelId?: string;
	systemPrompt?: string;
	signal?: AbortSignal;
	onConfirm: ConfirmFn;
	onEvent(event: AgentEvent): Promise<void> | void;
}

export interface AgentRunResult {
	sessionId: string;
	doneMessageId?: string;
	forkedSessionId?: string;
	content: string;
	reasoning: string;
}

/**
 * HttpAgentRunner — 通过共享后端 HTTP 运行 agent
 *
 * 与 AgentRunner 同签名（drop-in），但不在本进程内跑 AgentLoop，而是 POST /api/chat
 * 读取 SSE 事件流，转交给 onEvent。遇到 confirm_required 时先调用 onConfirm 取得用户决定，
 * 再 POST /api/confirm 把结果回传后端（与浏览器前端同一套确认协议）。
 *
 * 这样 TUI/prompt 与 Web 共享同一个后端进程：会话、记忆、后台服务都在后端统一处理。
 */
export class HttpAgentRunner {
	constructor(private readonly baseURL: string) {}

	async run(options: AgentRunOptions): Promise<AgentRunResult> {
		const clientMessageId = randomUUID();
		const body: Record<string, unknown> = {
			message: options.message,
			workspace: options.workspace,
			clientMessageId
		};
		if (options.sessionId && !options.newSession) body.sessionId = options.sessionId;
		if (options.modelId) body.model = options.modelId;

		let res: Response;
		try {
			res = await fetch(`${this.baseURL}/api/chat`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
				signal: options.signal
			});
		} catch (error) {
			if (options.signal?.aborted) throw new CliError('CANCELLED', '运行已取消', { cause: error });
			throw new CliError('IO', `无法连接后端：${(error as Error).message}`, { cause: error });
		}

		if (!res.ok || !res.body) {
			let msg = `后端返回 ${res.status}`;
			try {
				const err = await res.json() as { error?: string };
				if (err.error) msg = err.error;
			} catch { /* keep default */ }
			throw new CliError('AGENT', msg);
		}

		let sessionId = res.headers.get('X-Session-Id') || options.sessionId || '';
		let doneMessageId: string | undefined;
		let forkedSessionId: string | undefined;
		let content = '';
		let reasoning = '';

		const reader = res.body.getReader();
		const decoder = new TextDecoder();
		let buffer = '';

		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split('\n');
				buffer = lines.pop() || '';

				for (const line of lines) {
					const trimmed = line.trim();
					if (!trimmed.startsWith('data:')) continue;
					const data = trimmed.slice(5).trim();
					if (!data) continue;

					let event: AgentEvent;
					try {
						event = JSON.parse(data) as AgentEvent;
					} catch {
						continue;
					}

					if (event.type === 'content') content += event.text;
					if (event.type === 'reasoning') reasoning += event.text;
					if (event.type === 'done') doneMessageId = event.messageId;
					if (event.type === 'forked') {
						forkedSessionId = event.newSessionId;
						sessionId = event.newSessionId;
					}

					await options.onEvent(event);

					if (event.type === 'confirm_required') {
						await this.handleConfirm(event, options);
					}
				}
			}
		} catch (error) {
			if (options.signal?.aborted) {
				throw new CliError('CANCELLED', '运行已取消', { cause: error });
			}
			throw new CliError('AGENT', (error as Error).message || 'Agent 运行失败', { cause: error });
		} finally {
			reader.releaseLock();
		}

		return {
			sessionId: forkedSessionId || sessionId,
			doneMessageId,
			forkedSessionId,
			content,
			reasoning
		};
	}

	private async handleConfirm(
		event: Extract<AgentEvent, { type: 'confirm_required' }>,
		options: AgentRunOptions
	): Promise<void> {
		let approved = false;
		try {
			approved = await options.onConfirm(event.confirmation, event.confirmId);
		} catch {
			approved = false;
		}
		try {
			await fetch(`${this.baseURL}/api/confirm`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ confirmId: event.confirmId, approved }),
				signal: options.signal
			});
		} catch {
			// 后端可能已随流关闭；确认失败时下轮 SSE 会反映错误
		}
	}
}
