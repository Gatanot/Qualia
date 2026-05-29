import type { ToolDef, ToolResult } from './types';
import type { Tool } from '$lib/provider';

export class ToolRegistry {
	private tools = new Map<string, ToolDef>();

	register(tool: ToolDef): void {
		this.tools.set(tool.name, tool);
	}

	unregister(name: string): boolean {
		return this.tools.delete(name);
	}

	get(name: string): ToolDef | undefined {
		return this.tools.get(name);
	}

	getDefinitions(): Tool[] {
		return Array.from(this.tools.values()).map((tool) => ({
			type: 'function' as const,
			function: {
				name: tool.name,
				description: tool.description,
				parameters: tool.parameters
			}
		}));
	}

	async execute(
		name: string,
		args: Record<string, unknown>,
		workspaceRoot: string
	): Promise<ToolResult> {
		const tool = this.tools.get(name);
		if (!tool) {
			return { success: false, output: '', error: `未知工具: ${name}` };
		}
		return tool.execute(args, workspaceRoot);
	}
}
