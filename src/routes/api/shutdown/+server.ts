import { json } from '@sveltejs/kit';
import { closeStorage } from '$lib/storage';

export async function POST() {
	closeStorage();
	const timeout = setTimeout(() => process.exit(0), 200);
	timeout.unref();
	return json({ success: true, message: 'Qualia 后端正在关闭...' });
}
