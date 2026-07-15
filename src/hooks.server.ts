import { createSummarizeWorker } from '$lib/agent';
import { initGateway } from '$lib/gateway/lifecycle';
import { GatewayDispatcher } from '$lib/gateway';
import { getAllChatIds } from '$lib/gateway';
import { startScheduler, stopScheduler, setTaskNotificationHandler } from '$lib/task';
import type { GatewayNotification } from '$lib/gateway';
import { acquireServerLock } from '$lib/server';
import { closeStorage } from '$lib/storage';

let gateway: GatewayDispatcher | null = null;
const summarize = createSummarizeWorker(notifyAll);

async function notifyAll(notification: GatewayNotification): Promise<void> {
	if (!gateway) return;

	await gateway.notify(notification, { adapterFilter: (a) => a.name !== 'telegram' });

	const text = `**${notification.title}**\n\n${notification.body}`;
	for (const chatId of getAllChatIds()) {
		await gateway.send('telegram', chatId, text);
	}
}

setTaskNotificationHandler(async (notification) => {
	await notifyAll(notification);
});

function startup() {
	gateway = initGateway();
	summarize.start();
	startScheduler();
}

function shutdown() {
	summarize.stop();
	stopScheduler();
	if (gateway) {
		gateway.stop();
		gateway = null;
	}
	closeStorage();
}

process.on('exit', () => {
	closeStorage();
});

// 后台服务（summarizer/scheduler/gateway）只在持有后端单例锁的进程里启动，
// 避免多个 serve/dev 进程各自扫描同一份 ~/.qualia 数据、重复跑定时任务与 telegram 轮询。
// 此处 host/port 仅为记录用途；serve.ts 会先以真实端口获取锁，同进程可重入。
const lock = acquireServerLock({ host: '127.0.0.1', port: 0 });
if (lock.acquired) {
	startup();

	if (import.meta.hot) {
		import.meta.hot.dispose(() => {
			shutdown();
			lock.release();
		});
	}
} else {
	const e = lock.existing;
	const where = e ? `http://${e.host}:${e.port} (pid ${e.pid})` : '(unknown)';
	console.warn(`[qualia] 已有后端在运行 ${where}，本进程仅提供 HTTP，不启动后台服务（摘要/调度/网关）。`);
}
