import { rm, stat } from 'node:fs/promises';
import type { ToolDef, ToolResult } from '../types.js';
import type { ToolContext } from '../env.js';
import { PendingConfirmation } from '../types.js';

/**
 * delete_file — 删除文件
 *
 * 删除操作始终需要用户确认（不可逆）。
 * 仅支持删除文件，不支持删除目录。
 * 系统路径始终拒绝。
 */
export const deleteFileTool: ToolDef = {
	name: 'delete_file',
	description: 'Delete a file. Always requires user confirmation.',
	parameters: {
		type: 'object',
		properties: {
			path: {
				type: 'string',
				description: 'File path (relative to workspace or absolute)'
			}
		},
		required: ['path']
	},

	async execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
		const userPath = args.path as string;
		if (!userPath) {
			return { success: false, output: '', error: '缺少参数: path' };
		}

		const resolved = ctx.resolvePath(userPath);
		const { path: filePath, classification } = resolved;

		if (classification === 'reject') {
			return { success: false, output: '', error: `拒绝删除系统路径: ${userPath}` };
		}

		if (!args.__confirmed) {
			throw new PendingConfirmation(
				'delete_file',
				{ path: userPath },
				`确认删除 "${userPath}"？此操作不可恢复。`
			);
		}

		try {
			const info = await stat(filePath);

			if (info.isDirectory()) {
				return { success: false, output: '', error: `目标是目录而非文件: ${userPath}` };
			}

			await rm(filePath);
			return { success: true, output: `已删除文件: ${userPath}` };
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
				return { success: false, output: '', error: `路径不存在: ${userPath}` };
			}
			return { success: false, output: '', error: `删除失败: ${(error as Error).message}` };
		}
	}
};
