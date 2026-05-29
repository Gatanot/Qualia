/**
 * Tool System 模块
 *
 * 可插拔的工具注册与执行框架，用于 LLM function calling。
 * 内置四个工具：read_file / write_file / delete_file / execute_command。
 * 包含安全判定引擎，对危险操作实施确认或拒绝策略。
 *
 * @module tool
 *
 * @example
 * ```ts
 * import { ToolRegistry, readFileTool, execTool } from '$lib/tool';
 *
 * const registry = new ToolRegistry();
 * registry.register(readFileTool);
 * registry.register(execTool);
 *
 * // 获取 OpenAI function calling 格式
 * const tools = registry.getDefinitions();
 *
 * // 执行
 * const result = await registry.execute('read_file', { path: 'src/app.ts' }, process.cwd());
 * ```
 */

export { ToolRegistry } from './registry';
export { PendingConfirmation } from './types';
export type { ToolDef, ToolResult, CommandClassification } from './types';
export { classifyCommand, classifyFilePath } from './safeguard';
export { readFileTool } from './tools/read-file';
export { writeFileTool } from './tools/write-file';
export { deleteFileTool } from './tools/delete-file';
export { execTool } from './tools/exec';
