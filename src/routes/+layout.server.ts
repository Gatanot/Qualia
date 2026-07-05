import { getThemeData } from '$lib/theme/server-theme';

export async function load() {
	const theme = getThemeData();
	return theme;
}
