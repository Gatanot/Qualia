import { redirect } from '@sveltejs/kit';
import { readConfig } from '$lib/config';
import { createStorage } from '$lib/storage';

export async function load() {
	const config = readConfig();
	const storage = createStorage({ enabled: config.storageEnabled });
	const recent = await storage.getMostRecentSession();
	if (recent) {
		redirect(302, `/chat/${recent.id}`);
	}
	return {};
}
