/**
 * Table-driven DFA matchers. No regex anywhere.
 */

// ---- DFA 1: Extract SGR mouse button from ESC[<NN;...M ----

export function parseSgrButton(buf: Buffer): number | null {
	if (buf.length < 5) return null;
	if (buf[0] !== 0x1B) return null;
	if (buf[1] !== 0x5B) return null;
	if (buf[2] !== 0x3C) return null;

	let i = 3;
	let btn = 0;
	let found = false;
	while (i < buf.length) {
		const b = buf[i];
		if (b >= 0x30 && b <= 0x39) {
			btn = btn * 10 + (b - 0x30);
			found = true;
		} else if (b === 0x3B) {
			return found ? btn : null;
		} else {
			return found ? btn : null;
		}
		i++;
	}
	return null;
}

// ---- DFA 2: Split string by whitespace (table-driven) ----

export function splitByWhitespace(input: string): string[] {
	const result: string[] = [];
	let start = -1;
	for (let i = 0; i < input.length; i++) {
		const c = input.charCodeAt(i);
		const isSpace = c === 0x20 || c === 0x09;
		if (!isSpace && start === -1) {
			start = i;
		}
		if (isSpace && start !== -1) {
			result.push(input.slice(start, i));
			start = -1;
		}
	}
	if (start !== -1) {
		result.push(input.slice(start));
	}
	return result;
}

// ---- DFA 3: Strip HTML tags ----

export function stripHtmlTags(input: string): string {
	const out: string[] = [];
	let inTag = false;
	for (let i = 0; i < input.length; i++) {
		const ch = input[i];
		if (ch === '<') {
			inTag = true;
			continue;
		}
		if (ch === '>' && inTag) {
			inTag = false;
			continue;
		}
		if (!inTag) {
			out.push(ch);
		}
	}
	return out.join('');
}

// ---- DFA 4: Strip ANSI escape sequences ----

export function stripAnsi(input: string): string {
	const out: string[] = [];
	let i = 0;
	while (i < input.length) {
		const cp = input.codePointAt(i) || input.charCodeAt(i);

		if (cp === 0x1B) {
			let j = i + 1;
			if (j < input.length && input.codePointAt(j) === 0x5B) {
				j++;
				while (j < input.length) {
					const b = input.codePointAt(j) || 0;
					if ((b >= 0x30 && b <= 0x39) || b === 0x3B) {
						j++;
					} else {
						break;
					}
				}
				if (j < input.length) {
					const final = input.codePointAt(j) || 0;
					if ((final >= 0x41 && final <= 0x5A) || (final >= 0x61 && final <= 0x7A)) {
						j++;
					}
				}
				i = j;
				continue;
			}
		}

		if (cp === 0x07) {
			i++;
			continue;
		}

		if (cp < 0x10000) {
			out.push(String.fromCodePoint(cp));
			i++;
		} else {
			out.push(String.fromCodePoint(cp));
			i += 2;
		}
	}
	return out.join('');
}
