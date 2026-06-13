/**
 * 工具注册表
 *
 * 管理工具的注册、查询和调度。
 * 提供 getDefinitions() 将已注册工具转为 OpenAI function calling 格式。
 */
export class ToolRegistry {
	private tools = new Map<string, import('./types').ToolDef>();

	/** 注册一个工具 */
	register(tool: import('./types').ToolDef): void {
		this.tools.set(tool.name, tool);
	}

	/** 注销一个工具 */
	unregister(name: string): boolean {
		return this.tools.delete(name);
	}

	/** 按名称获取工具 */
	get(name: string): import('./types').ToolDef | undefined {
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
	 * @param workspaceRoot - 工作区根目录
	 * @returns 执行结果
	 * @throws PendingConfirmation 需要用户确认时
	 */
	async execute(
		name: string,
		args: Record<string, unknown>,
		workspaceRoot: string
	): Promise<import('./types').ToolResult> {
		const tool = this.tools.get(name);
		if (!tool) {
			return { success: false, output: '', error: `未知工具: ${name}` };
		}
		return tool.execute(args, workspaceRoot);
	}
}
