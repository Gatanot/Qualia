type Theme = 'light' | 'dark';

function getSystemTheme(): Theme {
	if (typeof window === 'undefined') return 'light';
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getStoredTheme(): Theme | null {
	if (typeof window === 'undefined') return null;
	return localStorage.getItem('qualia-theme') as Theme | null;
}

function applyTheme(theme: Theme) {
	if (typeof document === 'undefined') return;
	document.documentElement.setAttribute('data-theme', theme);
}

let current: Theme = getStoredTheme() || getSystemTheme();

export function initTheme() {
	applyTheme(current);
	if (typeof window !== 'undefined') {
		window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
			if (!getStoredTheme()) {
				current = e.matches ? 'dark' : 'light';
				applyTheme(current);
			}
		});
	}
}

export function getTheme(): Theme {
	return current;
}

export function setTheme(theme: Theme) {
	current = theme;
	if (typeof window !== 'undefined') {
		localStorage.setItem('qualia-theme', theme);
	}
	applyTheme(theme);
}

export function toggleTheme() {
	setTheme(current === 'light' ? 'dark' : 'light');
}
