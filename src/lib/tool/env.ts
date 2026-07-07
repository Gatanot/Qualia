import { resolve } from 'node:path';
import { classifyFilePath, classifyCommand } from './safeguard';
import type { CommandClassification } from './types';

/**
 * ToolContext — 工具执行上下文
 *
 * 封装工作区根目录、路径解析和安全检查。
 * 替换原来分散在工具中的 resolve() + classifyFilePath/classifyCommand 模式。
 */
export class ToolContext {
	readonly root: string;
	readonly sessionId?: string;

	onUpdate?: (chunk: string) => void;

	constructor(root: string, sessionId?: string) {
		this.root = root;
		this.sessionId = sessionId;
	}

	/** 解析用户输入的路径，同时做安全检查 */
	resolvePath(userPath: string): { path: string; classification: CommandClassification } {
		const resolved = resolve(this.root, userPath);
		const classification = classifyFilePath(resolved, this.root);
		return { path: resolved, classification };
	}

	/** 分类终端命令的安全性 */
	classifyCommand(command: string): CommandClassification {
		return classifyCommand(command, this.root);
	}
}
