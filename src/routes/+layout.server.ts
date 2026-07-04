import { resolveTheme } from '$lib/theme/server-theme';

export async function load() {
	const theme = resolveTheme();
	return theme;
}
