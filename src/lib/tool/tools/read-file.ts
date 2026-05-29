import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { ToolDef, ToolResult } from '../types';
import { classifyFilePath } from '../safeguard';
import { PendingConfirmation } from '../types';

const MAX_FILE_SIZE = 1024 * 1024;

export const readFileTool: ToolDef = {
	name: 'read_file',
	description: '读取指定文件的内容。用于查看代码、配置、文档等文件。',
	parameters: {
		type: 'object',
		properties: {
			path: {
				type: 'string',
				description: '要读取的文件路径（支持相对于工作区的路径或绝对路径）'
			}
		},
		required: ['path']
	},

	async execute(args: Record<string, unknown>, workspaceRoot: string): Promise<ToolResult> {
		const userPath = args.path as string;
		if (!userPath) {
			return { success: false, output: '', error: '缺少参数: path' };
		}

		const filePath = resolve(workspaceRoot, userPath);

		if (!args.__confirmed) {
			const classification = classifyFilePath(filePath, workspaceRoot);
			if (classification === 'confirm') {
				throw new PendingConfirmation(
					'read_file',
					{ path: userPath },
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
			const preview = lines.slice(0, 500).join('\n');
			const truncated = lines.length > 500
				? `\n\n... (共 ${lines.length} 行，仅展示前 500 行)`
				: '';

			return {
				success: true,
				output: `=== ${userPath} ===\n${preview}${truncated}`
			};
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
				return { success: false, output: '', error: `文件不存在: ${userPath}` };
			}
			return { success: false, output: '', error: `读取失败: ${(error as Error).message}` };
		}
	}
};
