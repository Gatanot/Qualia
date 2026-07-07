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
 * import { ToolRegistry, CORE_TOOLS } from '$lib/tool';
 *
 * const registry = new ToolRegistry();
 * for (const t of CORE_TOOLS) registry.register(t);
 * ```
 */

export { ToolRegistry } from './registry';
export { PendingConfirmation } from './types';
export type { ToolDef, ToolResult, CommandClassification } from './types';
export { classifyCommand, classifyFilePath } from './safeguard';
export { ToolContext } from './env';

// 工具定义
import { readFileTool } from './tools/read-file';
import { writeFileTool } from './tools/write-file';
import { deleteFileTool } from './tools/delete-file';
import { editTool } from './tools/edit';
import { execTool } from './tools/exec';
import { webSearchTool } from './tools/web-search';
import { readMemoryTool } from './tools/read-memory';
import { proposeMemoryTool } from './tools/propose-memory';
import { readDiaryTool } from './tools/read-diary';
import { scheduleTaskTool } from './tools/schedule-task';
import { readTasksTool } from './tools/read-tasks';

export { readFileTool, writeFileTool, deleteFileTool, editTool, execTool, webSearchTool, readMemoryTool, proposeMemoryTool, readDiaryTool, scheduleTaskTool, readTasksTool };
export { createSearchHistoryTool } from './tools/search-history';

import type { ToolDef } from './types';

/** 核心工具集：文件操作 + 搜索 + 记忆（Chat / Gateway 使用，再拼接 SCHEDULING_TOOLS 即为全量） */
export const CORE_TOOLS: ToolDef[] = [
	readFileTool,
	writeFileTool,
	deleteFileTool,
	editTool,
	execTool,
	webSearchTool,
	readMemoryTool,
	proposeMemoryTool,
	readDiaryTool,
];

/** 调度工具集 */
export const SCHEDULING_TOOLS: ToolDef[] = [
	scheduleTaskTool,
	readTasksTool,
];
