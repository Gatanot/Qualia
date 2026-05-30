export function formatSessionTitle(today: Date, count: number): string {
	const y = today.getFullYear();
	const m = String(today.getMonth() + 1).padStart(2, '0');
	const d = String(today.getDate()).padStart(2, '0');
	const n = String(count).padStart(2, '0');
	return `${y}-${m}-${d}-${n}`;
}
