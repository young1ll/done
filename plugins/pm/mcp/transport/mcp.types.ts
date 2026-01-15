/**
 * MCP Protocol Types for NestJS Integration
 */

export interface MCPToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface MCPToolResult {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
  _meta?: Record<string, unknown>;
}

export interface MCPResourceDescription {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface MCPPromptDescription {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

export interface MCPToolDescription {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * Decorator metadata keys
 */
export const MCP_TOOL_METADATA = 'mcp:tool';
export const MCP_RESOURCE_METADATA = 'mcp:resource';
export const MCP_PROMPT_METADATA = 'mcp:prompt';

/**
 * MCP Tool Handler Metadata
 */
export interface MCPToolMetadata {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}
