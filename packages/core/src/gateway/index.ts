export { GatewayDispatcher } from './dispatcher.js';
export { EmailAdapter } from './adapters/email.js';
export type { EmailConfig } from './adapters/email.js';
export { TelegramAdapter } from './adapters/telegram.js';
export type { TelegramConfig } from './adapters/telegram.js';
export { getBoundSession, setBoundSession, getAllChatIds } from './adapters/telegram-sessions.js';
export { initGateway } from './lifecycle.js';
export type { GatewayAdapter, AdapterCapabilities, SendResult, InboundMessage, GatewayNotification, GatewayHookFactory } from './types.js';
