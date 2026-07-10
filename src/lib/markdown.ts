import { marked } from 'marked';
import hljs from 'highlight.js';
import katex from 'katex';

interface MathToken {
	type: 'mathBlock' | 'mathInline';
	raw: string;
	text: string;
}

function renderMathBlock(token: MathToken): string {
	const text = token.text;
	try {
		const html = katex.renderToString(text, {
			displayMode: true,
			throwOnError: false,
			strict: false
		});
		return `<div class="math-block">${html}</div>`;
	} catch {
		return `<pre>${token.raw}</pre>`;
	}
}

function renderMathInline(token: MathToken): string {
	const text = token.text;
	try {
		return katex.renderToString(text, {
			displayMode: false,
			throwOnError: false,
			strict: false
		});
	} catch {
		return token.raw;
	}
}

marked.setOptions({
	renderer: new marked.Renderer(),
	gfm: true,
	breaks: false
});

marked.use({
	async: false,
	renderer: {
		code({ text, lang }: { text: string; lang?: string }) {
			let highlighted = '';
			try {
				if (lang && hljs.getLanguage(lang)) {
					highlighted = hljs.highlight(text, { language: lang }).value;
				} else {
					highlighted = hljs.highlightAuto(text).value;
				}
			} catch {
				highlighted = text;
			}
			const langLabel = lang ? `<span class="code-lang">${lang}</span>` : '';
			return `<pre><code class="hljs">${highlighted}</code>${langLabel}</pre>`;
		}
	}
});

marked.use({
	extensions: [{
		name: 'mathBlock',
		level: 'block',
		start(src: string) { return src.indexOf('$$'); },
		tokenizer(src: string) {
			const match = src.match(/^\$\$\n?([\s\S]+?)\n?\$\$/);
			if (!match) return undefined;
			return {
				type: 'mathBlock',
				raw: match[0],
				text: match[1].trim()
			};
		},
		renderer(token) {
			return renderMathBlock(token as MathToken);
		}
	}, {
		name: 'mathInline',
		level: 'inline',
		start(src: string) {
			const i = src.indexOf('$');
			return i >= 0 && src[i + 1] !== '$' ? i : -1;
		},
		tokenizer(src: string) {
			const match = src.match(/^\$([^\$\n]+?)\$/);
			if (!match) return undefined;
			return {
				type: 'mathInline',
				raw: match[0],
				text: match[1].trim()
			};
		},
		renderer(token) {
			return renderMathInline(token as MathToken);
		}
	}]
});

export function renderMarkdown(text: string): string {
	return marked.parse(text) as string;
}
