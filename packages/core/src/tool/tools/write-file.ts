import { readFile, mkdir, stat } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { ToolDef, ToolResult } from '../types.js';
import type { ToolContext } from '../env.js';
import { PendingConfirmation } from '../types.js';
import { detectMeta, atomicWrite } from './file-utils.js';

/**
 * write_file — 写入文件内容
 *
 * 自动创建不存在的父目录。覆盖已有文件。
 * 使用原子写入（临时文件 + rename），崩溃时不留残缺文件。
 * 覆盖已有文件时自动保留原文件的 BOM 和行尾格式（CRLF/LF）。
 * 工作区内文件直接写入；工作区外需用户确认。
 */
export const writeFileTool: ToolDef = {
	name: 'write_file',
	description: 'Write content to a file (overwrites). Creates missing parent directories automatically. Preserves existing file encoding (BOM, line endings) when overwriting.',
	parameters: {
		type: 'object',
		properties: {
			path: {
				type: 'string',
				description: 'File path (relative to workspace or absolute)'
			},
			content: {
				type: 'string',
				description: 'Complete file content to write'
			}
		},
		required: ['path', 'content']
	},

	async execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
		const userPath = args.path as string;
		const content = args.content as string;

		if (!userPath) {
			return { success: false, output: '', error: '缺少参数: path' };
		}
		if (content === undefined || content === null) {
			return { success: false, output: '', error: '缺少参数: content' };
		}

		const resolved = ctx.resolvePath(userPath);
		const { path: filePath, classification } = resolved;

		if (!args.__confirmed) {
			if (classification === 'reject') {
				return { success: false, output: '', error: `拒绝写入系统路径: ${userPath}` };
			}
			if (classification === 'confirm') {
				throw new PendingConfirmation(
					'write_file',
					{ path: userPath, content },
					`文件 "${userPath}" 在工作区之外，确认写入？`
				);
			}
		}

		try {
			await mkdir(dirname(filePath), { recursive: true });

			let existed = false;
			let meta = undefined;
			try {
				const info = await stat(filePath);
				existed = info.isFile();
				if (existed) {
					const raw = await readFile(filePath, 'utf-8');
					meta = detectMeta(raw);
				}
			} catch {
				// new file
			}

			await atomicWrite(filePath, content, meta);

			const action = existed ? '已更新' : '已创建';
			const lines = content.split('\n').length;
			const bytes = Buffer.byteLength(content, 'utf-8');
			const metaNote = meta?.bom ? ' (已保留 BOM)' : '';

			return {
				success: true,
				output: `${action}文件: ${userPath} (${lines} 行, ${bytes} 字节${metaNote})`
			};
		} catch (error) {
			return { success: false, output: '', error: `写入失败: ${(error as Error).message}` };
		}
	}
};
