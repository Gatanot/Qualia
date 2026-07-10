import type { GatewayAdapter, GatewayNotification, InboundMessage } from './types.js';

export type InboundHandler = (message: InboundMessage, adapter: GatewayAdapter, reply: (text: string) => Promise<void>) => Promise<void>;

export class GatewayDispatcher {
	private adapters = new Map<string, GatewayAdapter>();
	private started = false;
	private inboundHandler: InboundHandler | null = null;

	onInbound(handler: InboundHandler): void {
		this.inboundHandler = handler;

		for (const adapter of this.adapters.values()) {
			if (adapter.capabilities.receive) {
				this.setupAdapterMessageHandler(adapter);
			}
		}
	}

	register(adapter: GatewayAdapter): void {
		this.adapters.set(adapter.name, adapter);

		if (adapter.capabilities.receive && this.inboundHandler) {
			this.setupAdapterMessageHandler(adapter);
		}
	}

	private setupAdapterMessageHandler(adapter: GatewayAdapter): void {
		const handler = this.inboundHandler!;
		adapter.onMessage = async (msg: InboundMessage) => {
			await handler(msg, adapter, async (text: string) => {
				await adapter.send(msg.chatId, text);
			});
		};
	}

	unregister(name: string): void {
		this.adapters.delete(name);
	}

	async start(): Promise<void> {
		if (this.started) return;
		this.started = true;

		for (const [name, adapter] of this.adapters) {
			try {
				const ok = await adapter.connect();
				if (!ok) {
					console.error(`[gateway] ${name} connect failed`);
				}
			} catch (e) {
				console.error(`[gateway] ${name} connect error:`, (e as Error).message);
			}
		}
	}

	async stop(): Promise<void> {
		this.started = false;
		for (const [, adapter] of this.adapters) {
			try {
				await adapter.disconnect();
			} catch (e) {
				console.warn('适配器断开失败:', (e as Error).message);
			}
		}
	}

	async notify(
		notification: GatewayNotification,
		options?: { chatId?: string; adapterFilter?: (adapter: GatewayAdapter) => boolean }
	): Promise<void> {
		for (const [, adapter] of this.adapters) {
			if (!adapter.capabilities.notify) continue;
			if (options?.adapterFilter && !options.adapterFilter(adapter)) continue;

			try {
				// chatId 仅对多目标 adapter（如 Telegram）有意义；单目标 adapter（如 Email）忽略此参数。
				// 未提供 chatId 时传空串而非 'default'，避免向无效 chatId 发送。
				const target = options?.chatId ?? '';
				const text = `**${notification.title}**\n\n${notification.body}`;
				await adapter.send(target, text);
			} catch (e) {
				console.error(`[gateway] notify via ${adapter.name} failed:`, (e as Error).message);
			}
		}
	}

	async send(adapterName: string, chatId: string, text: string): Promise<boolean> {
		const adapter = this.adapters.get(adapterName);
		if (!adapter) return false;

		const result = await adapter.send(chatId, text);
		return result.success;
	}
}
