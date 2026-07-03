import { createSummarizeWorker } from '$lib/agent';
import { initGateway } from '$lib/gateway/lifecycle';
import { GatewayDispatcher } from '$lib/gateway';
import { getAllChatIds } from '$lib/gateway';
import { startScheduler, stopScheduler, setTaskNotificationHandler } from '$lib/task';
import type { GatewayNotification } from '$lib/gateway';

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
}

startup();

if (import.meta.hot) {
	import.meta.hot.dispose(() => {
		shutdown();
	});
}
