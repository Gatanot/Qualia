export interface ToolDef {
	name: string;
	description: string;
	parameters: Record<string, unknown>;
	execute(args: Record<string, unknown>, workspaceRoot: string): Promise<ToolResult>;
}

export interface ToolResult {
	success: boolean;
	output: string;
	error?: string;
}

export class PendingConfirmation extends Error {
	constructor(
		public toolName: string,
		public args: Record<string, unknown>,
		public reason: string
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

export type CommandClassification = 'safe' | 'confirm' | 'reject';
