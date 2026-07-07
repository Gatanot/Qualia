import type { ToolContext } from './env';

/**
 * 工具定义接口
 *
 * 每个工具实现此接口，包含名称、描述、参数 schema 和执行逻辑。
 */
export interface ToolDef {
	/** 工具名称，用于 LLM function calling 和注册表查找 */
	name: string;
	/** 工具描述，用于 LLM 理解功能 */
	description: string;
	/** JSON Schema 参数定义 */
	parameters: Record<string, unknown>;
	/**
	 * 执行工具
	 * @param args - 调用参数
	 * @param ctx - 工具执行上下文（工作区根目录、路径安全等）
	 * @returns 执行结果
	 * @throws PendingConfirmation 当需要用户确认时
	 */
	execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult>;
}

/**
 * 工具执行结果
 */
export interface ToolResult {
	/** 是否成功 */
	success: boolean;
	/** 输出内容 */
	output: string;
	/** 错误描述（success 为 false 时填充） */
	error?: string;
}

/**
 * 待确认异常
 *
 * 工具执行时如需要用户确认，抛出此异常。
 * 上层 Agent Loop 捕获后通过 SSE 推送确认请求到前端，
 * 用户确认后以 __confirmed: true 重新调用工具。
 */
export class PendingConfirmation extends Error {
	constructor(
		/** 工具名称 */
		public toolName: string,
		/** 调用参数 */
		public args: Record<string, unknown>,
		/** 需要确认的原因（confirm UI 展示；CLI 单行渲染，勿含换行） */
		public reason: string,
		/** 用户拒绝时回传给 LLM 的 tool 结果内容，便于 AI 协商调整（默认「用户取消了此操作」） */
		public rejectHint?: string
	) {
		super(`Tool "${toolName}" requires confirmation: ${reason}`);
		this.name = 'PendingConfirmation';
	}

	toJSON() {
		return {
			toolName: this.toolName,
			args: this.args,
			reason: this.reason
		};
	}
}

/** 命令安全分类 */
export type CommandClassification = 'safe' | 'confirm' | 'reject';
