import { CustomTransportStrategy, Server as NestServer } from '@nestjs/microservices';
import { Server as MCPServer } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { MCPToolResult } from './mcp.types.js';

export class MCPTransportStrategy extends NestServer implements CustomTransportStrategy {
  private mcpServer!: MCPServer;
  private transport!: StdioServerTransport;
  private toolHandlers: Map<string, (args: any) => Promise<MCPToolResult>> = new Map();

  constructor(private readonly options: { name: string; version: string }) {
    super();
  }

  /**
   * Register a tool handler
   */
  registerToolHandler(name: string, handler: (args: any) => Promise<MCPToolResult>) {
    this.toolHandlers.set(name, handler);
  }

  /**
   * Start the MCP server
   */
  async listen(callback: () => void) {
    this.mcpServer = new MCPServer(this.options, {
      capabilities: {
        resources: {},
        tools: {},
        prompts: {},
      },
    });
    this.transport = new StdioServerTransport();

    // Register list_tools handler
    this.mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = Array.from(this.messageHandlers.entries()).map(([pattern, handler]) => {
        const metadata = (handler as any).metadata;
        return {
          name: pattern,
          description: metadata?.description || '',
          inputSchema: metadata?.inputSchema || { type: 'object' },
        };
      });

      return { tools };
    });

    // Register call_tool handler
    this.mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      const handler = this.toolHandlers.get(name);
      if (!handler) {
        return {
          content: [{ type: 'text', text: `Tool not found: ${name}` }],
          isError: true,
        };
      }

      try {
        const result = await handler(args || {});
        return result;
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    });

    await this.mcpServer.connect(this.transport);
    callback();
  }

  /**
   * Close the MCP server
   */
  close() {
    this.mcpServer?.close();
  }

  /**
   * Override to bind NestJS message handlers to MCP tools
   */
  bindHandler(pattern: string, callback: (...args: any[]) => Promise<any>) {
    // Store the handler for later tool registration
    const wrappedCallback = async (args: any) => {
      const result = await callback(args);
      return result;
    };

    this.toolHandlers.set(pattern, wrappedCallback);
  }
}
