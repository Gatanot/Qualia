/**
 * 工具注册表
 *
 * 管理工具的注册、查询和调度。
 * 提供 getDefinitions() 将已注册工具转为 OpenAI function calling 格式。
 * 支持 sourceId 追踪，可按来源批量卸载（为 extension 系统提供基础）。
 */

import type { ToolDef, ToolResult } from './types.js';
import { ToolContext } from './env.js';

export class ToolRegistry {
	private tools = new Map<string, ToolDef>();
	private sources = new Map<string, Set<string>>();

	/**
	 * 注册一个工具
	 * @param tool - 工具定义
	 * @param sourceId - 来源标识，默认为 'builtin'。用于批量卸载时按来源清理。
	 */
	register(tool: ToolDef, sourceId = 'builtin'): void {
		this.tools.set(tool.name, tool);
		if (!this.sources.has(sourceId)) {
			this.sources.set(sourceId, new Set());
		}
		this.sources.get(sourceId)!.add(tool.name);
	}

	/** 注销一个工具 */
	unregister(name: string): boolean {
		for (const [, names] of this.sources) {
			names.delete(name);
		}
		return this.tools.delete(name);
	}

	/**
	 * 按来源批量注销工具
	 * @param sourceId - 来源标识
	 * @returns 被注销的工具数量
	 */
	unregisterSource(sourceId: string): number {
		const names = this.sources.get(sourceId);
		if (!names) return 0;
		let count = 0;
		for (const name of names) {
			if (this.tools.delete(name)) count++;
		}
		this.sources.delete(sourceId);
		return count;
	}

	/** 按名称获取工具 */
	get(name: string): ToolDef | undefined {
		return this.tools.get(name);
	}

	/** 获取 OpenAI function calling 格式的工具定义列表 */
	getDefinitions(): import('$lib/ai').Tool[] {
		return Array.from(this.tools.values()).map((tool) => ({
			type: 'function' as const,
			function: {
				name: tool.name,
				description: tool.description,
				parameters: tool.parameters
			}
		}));
	}

	/**
	 * 按名称执行工具
	 *
	 * @param name - 工具名称
	 * @param args - 调用参数，支持 __confirmed 标记跳过确认流程
	 * @param ctx - 工具执行上下文
	 * @returns 执行结果
	 * @throws PendingConfirmation 需要用户确认时
	 */
	async execute(
		name: string,
		args: Record<string, unknown>,
		ctx: ToolContext
	): Promise<ToolResult> {
		const tool = this.tools.get(name);
		if (!tool) {
			return { success: false, output: '', error: `未知工具: ${name}` };
		}
		return tool.execute(args, ctx);
	}
}
