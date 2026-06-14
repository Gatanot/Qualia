import { writeFile, mkdir, stat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import type { ToolDef, ToolResult } from '../types';
import { classifyFilePath } from '../safeguard';
import { PendingConfirmation } from '../types';

/**
 * write_file — 写入文件内容
 *
 * 自动创建不存在的父目录。覆盖已有文件。
 * 工作区内文件直接写入；工作区外需用户确认。
 */
export const writeFileTool: ToolDef = {
	name: 'write_file',
	description: '将内容写入指定文件（覆盖已有内容）。会自动创建不存在的父目录。',
	parameters: {
		type: 'object',
		properties: {
			path: {
				type: 'string',
				description: '要写入的文件路径（支持相对于工作区的路径或绝对路径）'
			},
			content: {
				type: 'string',
				description: '要写入的完整文件内容'
			}
		},
		required: ['path', 'content']
	},

	async execute(args: Record<string, unknown>, workspaceRoot: string): Promise<ToolResult> {
		const userPath = args.path as string;
		const content = args.content as string;

		if (!userPath) {
			return { success: false, output: '', error: '缺少参数: path' };
		}
		if (content === undefined || content === null) {
			return { success: false, output: '', error: '缺少参数: content' };
		}

		const filePath = resolve(workspaceRoot, userPath);

		if (!args.__confirmed) {
			const classification = classifyFilePath(filePath, workspaceRoot);
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
			const dir = dirname(filePath);
			await mkdir(dir, { recursive: true });

			let existed = false;
			try {
				const info = await stat(filePath);
				existed = info.isFile();
			} catch {
				// file doesn't exist
			}

			await writeFile(filePath, content, 'utf-8');

			const action = existed ? '已更新' : '已创建';
			const lines = content.split('\n').length;
			const bytes = Buffer.byteLength(content, 'utf-8');

			return {
				success: true,
				output: `${action}文件: ${userPath} (${lines} 行, ${bytes} 字节)`
			};
		} catch (error) {
			return { success: false, output: '', error: `写入失败: ${(error as Error).message}` };
		}
	}
};
