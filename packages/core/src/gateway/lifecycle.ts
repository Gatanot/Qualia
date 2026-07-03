import { readConfig } from '../config/index.js';
import { GatewayDispatcher } from './dispatcher.js';
import { EmailAdapter } from './adapters/email.js';
import { TelegramAdapter } from './adapters/telegram.js';
import { createInboundHandler } from './inbound-handler.js';
import type { EmailConfig, TelegramConfig } from './index.js';

export function initGateway(): GatewayDispatcher | null {
	const config = readConfig();
	const gateway = new GatewayDispatcher();

	const emailConfig: EmailConfig = {
		smtpHost: config.emailSmtpHost,
		smtpPort: config.emailSmtpPort,
		smtpSecure: config.emailSmtpSecure,
		user: config.emailSmtpUser,
		password: config.emailSmtpPass,
		from: config.emailFrom,
		to: config.emailTo
	};

	if (config.emailNotifications && emailConfig.smtpHost && emailConfig.user && emailConfig.to) {
		const email = new EmailAdapter(emailConfig);
		gateway.register(email);
	}

	if (config.telegramEnabled && config.telegramBotToken) {
		const tgConfig: TelegramConfig = {
			botToken: config.telegramBotToken,
			allowedUsers: config.telegramAllowedUsers || ''
		};
		const telegram = new TelegramAdapter(tgConfig);
		gateway.register(telegram);
	}

	const hasAdapters = emailConfig.smtpHost || config.telegramBotToken;
	if (hasAdapters) {
		gateway.onInbound(createInboundHandler());
		gateway.start();
		return gateway;
	}

	return null;
}
