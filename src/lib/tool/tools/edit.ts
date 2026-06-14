import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { ToolDef, ToolResult } from '../types';
import { classifyFilePath } from '../safeguard';
import { PendingConfirmation } from '../types';
import { stripBom, detectMeta, normalizeToLF, atomicWrite } from './file-utils';

function escapeNewlines(s: string): string {
	return s.replace(/\r/g, '\\r').replace(/\n/g, '\\n');
}

function formatDiff(original: string, replacement: string): string {
	return `- ${escapeNewlines(original)}\n+ ${escapeNewlines(replacement)}`;
}

function countOccurrences(haystack: string, needle: string): number {
	if (!needle) return 0;
	let count = 0;
	let pos = 0;
	while (true) {
		pos = haystack.indexOf(needle, pos);
		if (pos === -1) break;
		count++;
		pos += needle.length;
	}
	return count;
}

/**
 * edit — 精确字符串替换编辑文件
 *
 * 在文件中查找 oldString 并替换为 newString。
 * 使用原子写入，自动保留原文件的 BOM 和行尾格式。
 * 非 replaceAll 模式下，oldString 必须在文件中恰好出现一次。
 */
export const editTool: ToolDef = {
	name: 'edit',
	description:
		'在文件中执行精确的字符串替换。查找 oldString 并用 newString 替换。非 replaceAll 模式下，oldString 必须在文件中恰好出现一次（防止误替换）。会自动保留原文件的 BOM 和行尾格式（CRLF/LF）。',
	parameters: {
		type: 'object',
		properties: {
			path: {
				type: 'string',
				description: '要编辑的文件路径（支持相对于工作区的路径或绝对路径）'
			},
			oldString: {
				type: 'string',
				description: '要被替换的原始文本（必须与文件中的内容完全匹配，包括缩进和空行）'
			},
			newString: {
				type: 'string',
				description: '替换后的新文本'
			},
			replaceAll: {
				type: 'boolean',
				description: '是否替换所有匹配项。默认为 false，此时 oldString 必须恰好出现一次。'
			}
		},
		required: ['path', 'oldString', 'newString']
	},

	async execute(args: Record<string, unknown>, workspaceRoot: string): Promise<ToolResult> {
		const userPath = args.path as string;
		const oldString = args.oldString as string;
		const newString = args.newString as string;
		const replaceAll = args.replaceAll === true;

		if (!userPath) {
			return { success: false, output: '', error: '缺少参数: path' };
		}
		if (oldString === undefined || oldString === null) {
			return { success: false, output: '', error: '缺少参数: oldString' };
		}
		if (newString === undefined || newString === null) {
			return { success: false, output: '', error: '缺少参数: newString' };
		}
		if (oldString === '') {
			return { success: false, output: '', error: 'oldString 不能为空' };
		}
		if (oldString === newString) {
			return { success: false, output: '', error: 'oldString 与 newString 相同，无需替换' };
		}

		const filePath = resolve(workspaceRoot, userPath);

		if (!args.__confirmed) {
			const classification = classifyFilePath(filePath, workspaceRoot);
			if (classification === 'reject') {
				return { success: false, output: '', error: `拒绝编辑系统路径: ${userPath}` };
			}
			if (classification === 'confirm') {
				throw new PendingConfirmation(
					'edit',
					{ path: userPath, oldString, newString, replaceAll },
					`文件 "${userPath}" 在工作区之外，确认编辑？`
				);
			}
		}

		try {
			const raw = await readFile(filePath, 'utf-8');
			const meta = detectMeta(raw);
			const content = stripBom(raw);

			// Strategy 1: exact match on original content
			let matchCount = countOccurrences(content, oldString);
			let effectiveOld = oldString;

			// Strategy 2: line-ending normalized match
			if (matchCount === 0) {
				const lfContent = normalizeToLF(content);
				const lfOld = normalizeToLF(oldString);
				const lfCount = countOccurrences(lfContent, lfOld);
				if (lfCount > 0) {
					matchCount = lfCount;
					effectiveOld = lfOld;
					// Apply replacement on LF-normalized content, then restore line endings
					const lfNew = normalizeToLF(newString);
					let result: string;
					if (replaceAll) {
						result = lfContent.split(lfOld).join(lfNew);
					} else {
						result = lfContent.replace(lfOld, lfNew);
					}
					// Re-apply original content's line endings
					if (meta.lineEnding === 'CRLF') {
						result = result.replace(/\n/g, '\r\n');
					}
					await atomicWrite(filePath, result, meta);

					const actualCount = replaceAll ? matchCount : 1;
					return {
						success: true,
						output: `已编辑: ${userPath}\n替换 ${actualCount} 处:\n${formatDiff(oldString, newString)}`
					};
				}
			}

			if (matchCount === 0) {
				return {
					success: false,
					output: '',
					error:
						`未在文件中找到 oldString。请确保 oldString 与文件内容完全一致（包括缩进和空行）。\n` +
						`文件路径: ${userPath}\n` +
						`oldString: ${escapeNewlines(oldString.slice(0, 200))}`
				};
			}

			if (!replaceAll && matchCount > 1) {
				return {
					success: false,
					output: '',
					error:
						`oldString 在文件中出现了 ${matchCount} 次。请提供更多上下文使匹配唯一，或设置 replaceAll: true 替换全部。`
				};
			}

			// Strategy 1: exact match, apply directly
			const result = replaceAll
				? content.split(oldString).join(newString)
				: content.replace(oldString, newString);

			await atomicWrite(filePath, result, meta);

			const actualCount = replaceAll ? matchCount : 1;
			return {
				success: true,
				output: `已编辑: ${userPath}\n替换 ${actualCount} 处:\n${formatDiff(oldString, newString)}`
			};
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
				return { success: false, output: '', error: `文件不存在: ${userPath}` };
			}
			if (error instanceof PendingConfirmation) throw error;
			return { success: false, output: '', error: `编辑失败: ${(error as Error).message}` };
		}
	}
};
