import type { GatewayAdapter, GatewayNotification } from './types';

export class GatewayDispatcher {
	private adapters = new Map<string, GatewayAdapter>();
	private started = false;

	register(adapter: GatewayAdapter): void {
		this.adapters.set(adapter.name, adapter);
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
			} catch { /* ignore */ }
		}
	}

	async notify(notification: GatewayNotification): Promise<void> {
		for (const [, adapter] of this.adapters) {
			if (!adapter.capabilities.notify) continue;

			try {
				await this.sendToAdapter(adapter, notification);
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

	private async sendToAdapter(adapter: GatewayAdapter, notification: GatewayNotification): Promise<void> {
		const text = `**${notification.title}**\n\n${notification.body}`;
		await adapter.send('default', text);
	}
}
