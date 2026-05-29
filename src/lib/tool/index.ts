export { ToolRegistry } from './registry';
export { PendingConfirmation } from './types';
export type { ToolDef, ToolResult, CommandClassification } from './types';
export { classifyCommand, classifyFilePath, isDangerousCommand, isPathInWorkspace } from './safeguard';
export { readFileTool } from './tools/read-file';
export { writeFileTool } from './tools/write-file';
export { deleteFileTool } from './tools/delete-file';
export { execTool } from './tools/exec';
