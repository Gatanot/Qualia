/**
 * Tool System 模块
 *
 * 可插拔的工具注册与执行框架，用于 LLM function calling。
 * 包含安全判定引擎，对危险操作实施确认或拒绝策略。
 *
 * 工具集数组（CORE_TOOLS / SCHEDULING_TOOLS）用于快速装配 ToolRegistry，
 * 避免在多个入口重复列清单。添加新工具时只需更新对应数组，无需修改调用方。
 *
 * @module tool
 *
 * @example
 * ```ts
 * import { ToolRegistry, CORE_TOOLS } from './index.js';
 *
 * const registry = new ToolRegistry();
 * for (const t of CORE_TOOLS) registry.register(t);
 * ```
 */

export { ToolRegistry } from './registry.js';
export { PendingConfirmation } from './types.js';
export type { ToolDef, ToolResult, CommandClassification } from './types.js';
export { classifyCommand, classifyFilePath } from './safeguard.js';
export { ToolContext } from './env.js';

// 工具定义
import { readFileTool } from './tools/read-file.js';
import { writeFileTool } from './tools/write-file.js';
import { deleteFileTool } from './tools/delete-file.js';
import { editTool } from './tools/edit.js';
import { execTool } from './tools/exec.js';
import { webSearchTool } from './tools/web-search.js';
import { readMemoryTool } from './tools/read-memory.js';
import { writeMemoryTool } from './tools/write-memory.js';
import { scheduleTaskTool } from './tools/schedule-task.js';
import { readTasksTool } from './tools/read-tasks.js';

export { readFileTool, writeFileTool, deleteFileTool, editTool, execTool, webSearchTool, readMemoryTool, writeMemoryTool, scheduleTaskTool, readTasksTool };
export { createSearchHistoryTool } from './tools/search-history.js';

import type { ToolDef } from './types.js';

/** 核心工具集：文件操作 + 搜索 + 记忆（Chat / Gateway 使用，再拼接 SCHEDULING_TOOLS 即为全量） */
export const CORE_TOOLS: ToolDef[] = [
	readFileTool,
	writeFileTool,
	deleteFileTool,
	editTool,
	execTool,
	webSearchTool,
	readMemoryTool,
	writeMemoryTool,
];

/** 调度工具集 */
export const SCHEDULING_TOOLS: ToolDef[] = [
	scheduleTaskTool,
	readTasksTool,
];
