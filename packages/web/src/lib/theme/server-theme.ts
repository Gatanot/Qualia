import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import defaultTheme from './default-theme.json';

export interface ColorEntry {
	light: string;
	dark: string;
}

export interface ThemeColors {
	[key: string]: ColorEntry;
}

export interface ThemeData {
	name: string;
	colors: ThemeColors;
}

export interface ThemeTokens {
	light: Record<string, string>;
	dark: Record<string, string>;
}

function loadUserTheme(): ThemeData | null {
	try {
		const userPath = join(homedir(), '.qualia', 'theme.json');
		const raw = readFileSync(userPath, 'utf8');
		const parsed = JSON.parse(raw);
		if (typeof parsed?.name === 'string' && parsed?.colors && typeof parsed.colors === 'object') {
			return { name: parsed.name, colors: parsed.colors as ThemeColors };
		}
	} catch {}
	return null;
}

function mergeColors(base: ThemeColors, override: ThemeColors): ThemeColors {
	const result: ThemeColors = { ...base };
	for (const key of Object.keys(override)) {
		result[key] = { ...base[key], ...override[key] };
	}
	return result;
}

/**
 * Resolve the active theme. User's ~/.qualia/theme.json merges over defaults.
 */
export function resolveTheme(): ThemeData {
	const user = loadUserTheme();
	if (!user) return defaultTheme as unknown as ThemeData;
	return {
		name: user.name,
		colors: mergeColors(
			(defaultTheme as unknown as ThemeData).colors,
			user.colors,
		),
	};
}

/**
 * Generate CSS variable tokens for light/dark from unified colors.
 */
export function generateTokens(colors: ThemeColors): ThemeTokens {
	const light: Record<string, string> = {};
	const dark: Record<string, string> = {};
	for (const [key, entry] of Object.entries(colors)) {
		light[`--${key}`] = entry.light;
		dark[`--${key}`] = entry.dark;
	}
	return { light, dark };
}

/**
 * Generate CLI TUI palette from dark variant of unified colors.
 * Returns a flat Record<string, string> suitable for ANSI rendering.
 */
export function getCliPalette(colors: ThemeColors): Record<string, string> {
	const palette: Record<string, string> = {};
	for (const [key, entry] of Object.entries(colors)) {
		palette[key] = entry.dark;
	}
	return palette;
}

/**
 * Get full theme data for API responses.
 */
export function getThemeData() {
	const theme = resolveTheme();
	return {
		name: theme.name,
		colors: theme.colors,
		tokens: generateTokens(theme.colors),
	};
}
