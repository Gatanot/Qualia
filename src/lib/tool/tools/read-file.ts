import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { ToolDef, ToolResult } from '../types';
import { classifyFilePath } from '../safeguard';
import { PendingConfirmation } from '../types';

const MAX_FILE_SIZE = 1024 * 1024;
const DEFAULT_OFFSET = 1;
const DEFAULT_LIMIT = 500;

function validateParam(name: string, value: unknown): number {
	if (value === undefined || value === null) return NaN;
	const n = Number(value);
	if (!Number.isInteger(n)) return NaN;
	if (n < 1) return NaN;
	return n;
}

/**
 * read_file — 读取文件内容
 *
 * 工作区内文件直接读取；工作区外文件需用户确认。
 * 文件大小限制 1 MB，超限返回错误。
 * 支持 offset / limit 按行翻页，不指定时默认读前 500 行。
 */
export const readFileTool: ToolDef = {
	name: 'read_file',
	description: '读取指定文件的内容。支持 offset / limit 按行翻页读取。用于查看代码、配置、文档等文件。',
	parameters: {
		type: 'object',
		properties: {
			path: {
				type: 'string',
				description: '要读取的文件路径（支持相对于工作区的路径或绝对路径）'
			},
			offset: {
				type: 'integer',
				description: '起始行号（从 1 开始），默认为 1'
			},
			limit: {
				type: 'integer',
				description: '最大读取行数，默认 500'
			}
		},
		required: ['path']
	},

	async execute(args: Record<string, unknown>, workspaceRoot: string): Promise<ToolResult> {
		const userPath = args.path as string;
		if (!userPath) {
			return { success: false, output: '', error: '缺少参数: path' };
		}

		let offset = DEFAULT_OFFSET;
		let limit = DEFAULT_LIMIT;

		if ('offset' in args && args.offset !== undefined && args.offset !== null) {
			const parsed = validateParam('offset', args.offset);
			if (isNaN(parsed)) {
				return { success: false, output: '', error: 'offset 必须是大于等于 1 的整数' };
			}
			offset = parsed;
		}

		if ('limit' in args && args.limit !== undefined && args.limit !== null) {
			const parsed = validateParam('limit', args.limit);
			if (isNaN(parsed)) {
				return { success: false, output: '', error: 'limit 必须是大于等于 1 的整数' };
			}
			limit = parsed;
		}

		const filePath = resolve(workspaceRoot, userPath);

		if (!args.__confirmed) {
			const classification = classifyFilePath(filePath, workspaceRoot);
			if (classification === 'reject') {
				return { success: false, output: '', error: `拒绝读取系统路径: ${userPath}` };
			}
			if (classification === 'confirm') {
				throw new PendingConfirmation(
					'read_file',
					{ path: userPath, offset, limit },
					`文件 "${userPath}" 在工作区之外，确认读取？`
				);
			}
		}

		try {
			const info = await stat(filePath);

			if (!info.isFile()) {
				return { success: false, output: '', error: `路径不是文件: ${userPath}` };
			}

			if (info.size > MAX_FILE_SIZE) {
				return {
					success: false,
					output: '',
					error: `文件过大 (${(info.size / 1024 / 1024).toFixed(1)} MB)，最大支持 1 MB`
				};
			}

			const content = await readFile(filePath, 'utf-8');
			const lines = content.split('\n');
			const totalLines = lines.length;
			const startIdx = offset - 1;

			if (startIdx >= totalLines) {
				return {
					success: true,
					output: `=== ${userPath} (第 ${offset}-${offset + limit - 1} 行 / 共 ${totalLines} 行) ===\n\n（起始行号超出文件末尾）`
				};
			}

			const endIdx = Math.min(startIdx + limit, totalLines);
			const slice = lines.slice(startIdx, endIdx);
			const atEnd = endIdx >= totalLines;
			const rangeLabel = `(第 ${offset}-${startIdx + slice.length} 行 / 共 ${totalLines} 行${atEnd ? '，已达文件末尾' : ''})`;

			return {
				success: true,
				output: `=== ${userPath} ${rangeLabel} ===\n${slice.join('\n')}`
			};
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
				return { success: false, output: '', error: `文件不存在: ${userPath}` };
			}
			return { success: false, output: '', error: `读取失败: ${(error as Error).message}` };
		}
	}
};
