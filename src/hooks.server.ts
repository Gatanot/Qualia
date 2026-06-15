import { readConfig } from '$lib/config';
import { runSummarizeJob } from '$lib/agent/background';
import { GatewayDispatcher, EmailAdapter } from '$lib/gateway';
import type { EmailConfig } from '$lib/gateway';
import { startScheduler, stopScheduler, setTaskNotificationHandler } from '$lib/task';

let running = false;
let lastScheduledDate = '';
let timerId: ReturnType<typeof setTimeout> | null = null;
let gateway: GatewayDispatcher | null = null;

function getToday(): string {
	const d = new Date();
	return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

async function initGateway(): Promise<void> {
	const config = readConfig();
	if (!config.emailNotifications) return;

	gateway = new GatewayDispatcher();

	const emailConfig: EmailConfig = {
		smtpHost: config.emailSmtpHost,
		smtpPort: config.emailSmtpPort,
		smtpSecure: config.emailSmtpSecure,
		user: config.emailSmtpUser,
		password: config.emailSmtpPass,
		from: config.emailFrom,
		to: config.emailTo
	};

	if (emailConfig.smtpHost && emailConfig.user && emailConfig.to) {
		const email = new EmailAdapter(emailConfig);
		gateway.register(email);
		await gateway.start();
	}
}

async function runBackgroundTasks() {
	if (running) return;
	running = true;

	try {
		const config = readConfig();
		if (!config.autoSummarize) return;

		let result: { summarized: number; diary: boolean } | undefined;

		if (config.summaryMode === 'scheduled') {
			const now = new Date();
			const today = getToday();
			if (now.getHours() >= (config.summaryScheduleHour || 2) && today !== lastScheduledDate) {
				lastScheduledDate = today;
				result = await runSummarizeJob(false, null);
			}
		} else {
			result = await runSummarizeJob();
		}

		if (result && gateway) {
			const { summarized, diary } = result;
			if (summarized > 0 || diary) {
				const parts: string[] = [];
				if (summarized > 0) parts.push(`已为 ${summarized} 个对话生成摘要`);
				if (diary) parts.push('已生成日记条目');
				await gateway.notify({
					title: 'Qualia 任务完成',
					body: parts.join('\n'),
					type: 'task_complete'
				});
			}
		}
	} catch {
	} finally {
		running = false;

		const config = readConfig();
		if (config.autoSummarize) {
			const intervalMin = config.summaryIntervalMin || 30;
			timerId = setTimeout(runBackgroundTasks, intervalMin * 60 * 1000);
		}
	}
}

export { gateway };

function cleanup() {
	if (timerId) {
		clearTimeout(timerId);
		timerId = null;
	}
	running = false;
	stopScheduler();
	if (gateway) {
		gateway.stop();
		gateway = null;
	}
}

setTaskNotificationHandler(async (notification) => {
	if (gateway) {
		await gateway.notify(notification);
	}
});

initGateway();
runBackgroundTasks();
startScheduler();

if (import.meta.hot) {
	import.meta.hot.dispose(() => {
		cleanup();
	});
}
