import type { AgentEvent, LoopHooks } from '../agent/index.js';

export interface AdapterCapabilities {
	receive: boolean;
	notify: boolean;
}

export interface SendResult {
	success: boolean;
	messageId?: string;
	error?: string;
}

export interface GatewayAdapter {
	readonly name: string;
	readonly capabilities: AdapterCapabilities;

	connect(): Promise<boolean>;
	disconnect(): Promise<void>;
	send(chatId: string, text: string): Promise<SendResult>;

	onMessage?: (event: InboundMessage) => Promise<void>;
	onError?: (error: Error) => void;
}

export interface InboundMessage {
	chatId: string;
	text: string;
	messageId?: string;
	timestamp: number;
}

export interface GatewayNotification {
	title: string;
	body: string;
	type: 'task_complete' | 'error' | 'info';
}

export type GatewayHookFactory = (sessionId: string) => LoopHooks;
