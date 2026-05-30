import { marked } from 'marked';
import hljs from 'highlight.js';

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

export function renderMarkdown(text: string): string {
	return marked.parse(text) as string;
}
