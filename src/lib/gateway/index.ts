export { GatewayDispatcher } from './dispatcher';
export { EmailAdapter } from './adapters/email';
export type { EmailConfig } from './adapters/email';
export { TelegramAdapter } from './adapters/telegram';
export type { TelegramConfig } from './adapters/telegram';
export { getBoundSession, setBoundSession, getAllChatIds } from './adapters/telegram-sessions';
export { initGateway } from './lifecycle';
export type { GatewayAdapter, AdapterCapabilities, SendResult, InboundMessage, GatewayNotification, GatewayHookFactory } from './types';
