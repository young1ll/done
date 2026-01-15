import { SetMetadata } from '@nestjs/common';
import { MCP_TOOL_METADATA, type MCPToolMetadata } from '../../../transport/mcp.types.js';

/**
 * Decorator to mark a method as an MCP tool handler
 *
 * @example
 * ```typescript
 * @MCPTool({
 *   name: 'pm_task_create',
 *   description: 'Create a new task',
 *   inputSchema: {
 *     type: 'object',
 *     properties: {
 *       title: { type: 'string' },
 *       projectId: { type: 'string' }
 *     },
 *     required: ['title', 'projectId']
 *   }
 * })
 * async createTask(args: CreateTaskDto) {
 *   // ...
 * }
 * ```
 */
export const MCPTool = (metadata: MCPToolMetadata) => SetMetadata(MCP_TOOL_METADATA, metadata);
