import type { GatewayAdapter, AdapterCapabilities, InboundMessage, SendResult } from '../types';

export interface EmailConfig {
	smtpHost: string;
	smtpPort: number;
	smtpSecure: boolean;
	user: string;
	password: string;
	from: string;
	to: string;
}

function parseCode(line: string): number {
	const slice = line.slice(0, 3);
	const code = parseInt(slice, 10);
	return isNaN(code) ? -1 : code;
}

function isFinalLine(line: string): boolean {
	return line.length >= 4 && line[3] === ' ';
}

async function sendSmtp(config: EmailConfig, subject: string, body: string): Promise<SendResult> {
	const { smtpHost, smtpPort, smtpSecure, user, password, from, to } = config;

	const auth = Buffer.from(`\x00${user}\x00${password}`).toString('base64');

	const socket = await new Promise<{ write: (d: string) => void; close: () => void; onData: (cb: (d: string) => void) => void; onRawData: (cb: (d: Buffer) => void) => void; onError: (cb: (e: Error) => void) => void }>((resolve, reject) => {
		const tls = smtpSecure;
		const net = tls ? require('node:tls') : require('node:net');

		const s = net.connect({ host: smtpHost, port: smtpPort, servername: smtpHost }, () => {
			let buffer = '';
			resolve({
				write: (d: string) => s.write(d),
				close: () => s.end(),
				onData: (cb: (d: string) => void) => { s.on('data', (data: Buffer) => { buffer += data.toString(); cb(buffer); }); },
				onRawData: (cb: (d: Buffer) => void) => { s.on('data', cb); },
				onError: (cb: (e: Error) => void) => { s.on('error', cb); }
			});
		});

		s.once('error', reject);
		setTimeout(() => reject(new Error('SMTP connect timeout')), 15000);
	});

	return new Promise<SendResult>((resolve) => {
		let step = 0;
		let lineBuf = '';

		const commands = [
			`EHLO qualia\r\n`,
			`AUTH PLAIN ${auth}\r\n`,
			`MAIL FROM:<${from}>\r\n`,
			`RCPT TO:<${to}>\r\n`,
			`DATA\r\n`,
			buildMailContent(from, to, subject, body),
			`QUIT\r\n`
		];

		socket.onRawData((data) => {
			lineBuf += data.toString();

			let idx: number;
			while ((idx = lineBuf.indexOf('\r\n')) !== -1) {
				const line = lineBuf.slice(0, idx + 2);
				lineBuf = lineBuf.slice(idx + 2);

				const code = parseCode(line);
				if (code < 0) continue;

				const isFinal = isFinalLine(line);

				if (code >= 400) {
					socket.close();
					resolve({ success: false, error: `SMTP error ${code}: ${line.slice(4, 100)}` });
					return;
				}

				if (!isFinal) continue;

				if (step === 0 && code === 220) step = 1;
				else if (step === 1 && code === 250) step = 2;
				else if (step === 2 && (code === 235 || code === 334)) step = 3;
				else if (step === 3 && code === 250) step = 4;
				else if (step === 4 && code === 250) step = 5;
				else if (step === 5 && code === 354) step = 6;
				else if (step === 6 && code === 250) {
					socket.close();
					resolve({ success: true });
					return;
				}

				if (step < commands.length) {
					socket.write(commands[step]);
					if (step === 5) step = 6;
				}
			}
		});

		socket.onError((e) => {
			resolve({ success: false, error: e.message });
		});

		setTimeout(() => {
			socket.close();
			resolve({ success: false, error: 'SMTP timeout' });
		}, 30000);
	});
}

function buildMailContent(from: string, to: string, subject: string, body: string): string {
	const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
<div style="border-left: 4px solid #6366f1; padding-left: 16px; margin-bottom: 24px;">
<h2 style="margin: 0 0 8px 0; color: #1e1b4b;">${escapeHtml(subject)}</h2>
<p style="margin: 0; color: #666; font-size: 13px;">Qualia AI 助手通知</p>
</div>
<div style="background: #f8fafc; border-radius: 8px; padding: 20px; line-height: 1.6;">
${body.split('\n').map((line) => `<p style="margin: 0 0 8px 0;">${escapeHtml(line) || '&nbsp;'}</p>`).join('')}
</div>
<hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
<p style="color: #94a3b8; font-size: 12px;">此邮件由 Qualia 自动发送。如需调整通知设置，请前往 Qualia 设置页面。</p>
</body>
</html>`;

	const lines = [
		`From: ${from}`,
		`To: ${to}`,
		`Subject: =?UTF-8?B?${Buffer.from(subject, 'utf-8').toString('base64')}?=`,
		`MIME-Version: 1.0`,
		`Content-Type: text/html; charset=utf-8`,
		`Content-Transfer-Encoding: base64`,
		'',
		Buffer.from(html, 'utf-8').toString('base64'),
		'',
		'.',
		''
	];

	return lines.join('\r\n');
}

function escapeHtml(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export class EmailAdapter implements GatewayAdapter {
	readonly name = 'email';
	readonly capabilities: AdapterCapabilities = { receive: false, notify: true };

	private config: EmailConfig;
	private connected = false;

	onMessage?: (event: InboundMessage) => Promise<void>;
	onError?: (error: Error) => void;

	constructor(config: EmailConfig) {
		this.config = config;
	}

	async connect(): Promise<boolean> {
		if (this.connected) return true;

		try {
			const result = await sendSmtp(
				this.config,
				'Qualia 网关已上线',
				'Email 通知适配器已成功连接。您将在任务完成时收到通知。'
			);
			this.connected = result.success;
			return result.success;
		} catch (e) {
			this.onError?.(e as Error);
			return false;
		}
	}

	async disconnect(): Promise<void> {
		this.connected = false;
	}

	async send(_chatId: string, text: string): Promise<SendResult> {
		if (!this.connected) {
			return { success: false, error: '未连接' };
		}

		const lines = text.split('\n');
		const subject = lines[0].replace(/^\*?\*?(.+?)\*?\*?$/, '$1') || 'Qualia 通知';
		const body = lines.slice(1).join('\n').trim() || text;

		return sendSmtp(this.config, subject, body);
	}
}
