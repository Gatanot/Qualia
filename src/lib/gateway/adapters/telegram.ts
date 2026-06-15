import type { GatewayAdapter, AdapterCapabilities, InboundMessage, SendResult, GatewayNotification } from '../types';
import { getBoundSession, setBoundSession } from './telegram-sessions';

export interface TelegramConfig {
	botToken: string;
	allowedUsers: string;
}

const POLL_INTERVAL = 2_000;

async function apiCall(token: string, method: string, body?: Record<string, unknown>): Promise<unknown> {
	const url = `https://api.telegram.org/bot${token}/${method}`;
	const res = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: body ? JSON.stringify(body) : undefined
	});
	return res.json();
}

export class TelegramAdapter implements GatewayAdapter {
	readonly name = 'telegram';
	readonly capabilities: AdapterCapabilities = { receive: true, notify: true };

	private config: TelegramConfig;
	private pollTimer: ReturnType<typeof setInterval> | null = null;
	private lastUpdateId = 0;
	private connected = false;

	onMessage?: (event: InboundMessage) => Promise<void>;
	onError?: (error: Error) => void;

	constructor(config: TelegramConfig) {
		this.config = config;
	}

	async connect(): Promise<boolean> {
		if (this.connected) return true;

		try {
			const me = await apiCall(this.config.botToken, 'getMe') as { ok: boolean; result?: { username: string } };
			if (!me.ok || !me.result) {
				console.error('[telegram] getMe failed:', JSON.stringify(me));
				return false;
			}

			console.log(`[telegram] connected as @${me.result.username}`);
			this.connected = true;

			this.pollTimer = setInterval(() => this.poll(), POLL_INTERVAL);
			this.poll();

			return true;
		} catch (e) {
			console.error('[telegram] connect error:', (e as Error).message);
			return false;
		}
	}

	async disconnect(): Promise<void> {
		this.connected = false;
		if (this.pollTimer) {
			clearInterval(this.pollTimer);
			this.pollTimer = null;
		}
	}

	async send(chatId: string, text: string): Promise<SendResult> {
		try {
			const result = await apiCall(this.config.botToken, 'sendMessage', {
				chat_id: chatId,
				text
			}) as { ok: boolean; result?: { message_id: number }; description?: string };

			if (result.ok) {
				return { success: true, messageId: String(result.result?.message_id || '') };
			}
			return { success: false, error: result.description || 'sendMessage failed' };
		} catch (e) {
			return { success: false, error: (e as Error).message };
		}
	}

	private isAllowed(chatId: string): boolean {
		const allowed = this.config.allowedUsers.trim();
		if (!allowed) return true;
		return allowed.split(',').map((s) => s.trim()).includes(chatId);
	}

	private async poll(): Promise<void> {
		if (!this.connected) return;

		try {
			const result = await apiCall(this.config.botToken, 'getUpdates', {
				offset: this.lastUpdateId + 1,
				timeout: 10,
				allowed_updates: ['message']
			}) as { ok: boolean; result?: TelegramUpdate[] };

			if (!result.ok || !result.result) return;

			for (const update of result.result) {
				this.lastUpdateId = update.update_id;

				const msg = update.message;
				if (!msg?.text || !msg.chat?.id) continue;

				const chatId = String(msg.chat.id);

				if (!this.isAllowed(chatId)) {
					await this.send(chatId, '你没有权限使用此 Bot。');
					continue;
				}

				const inbound: InboundMessage = {
					chatId,
					text: msg.text,
					messageId: String(msg.message_id),
					timestamp: msg.date * 1000
				};

				if (this.onMessage) {
					await this.onMessage(inbound);
				}
			}
		} catch {
			/* poll errors are transient */
		}
	}
}

interface TelegramUpdate {
	update_id: number;
	message?: {
		message_id: number;
		date: number;
		text?: string;
		chat?: { id: number };
	};
}
