#!/usr/bin/env node
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

async function bootstrap() {
  // Create NestJS application context (headless - no HTTP server)
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false, // Disable logging to avoid stdout pollution
  });

  // Get tool registry service (to be implemented)
  // const toolRegistry = app.get(MCPToolRegistry);

  // Create MCP Server
  const mcpServer = new Server(
    {
      name: 'pm-server',
      version: '2.0.0',
    },
    {
      capabilities: {
        resources: {},
        tools: {},
        prompts: {},
      },
    }
  );

  // Register list_tools handler
  mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
    // TODO: Get tools from NestJS controllers via reflection
    return {
      tools: [
        {
          name: 'pm_health_check',
          description: 'Health check endpoint',
          inputSchema: { type: 'object' },
        },
      ],
    };
  });

  // Register call_tool handler
  mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name } = request.params;

    // TODO: Route to NestJS controller methods
    if (name === 'pm_health_check') {
      return {
        content: [
          {
            type: 'text',
            text: 'PM Server v2.0.0 (NestJS) - Running',
          },
        ],
      };
    }

    return {
      content: [{ type: 'text', text: `Tool not implemented: ${name}` }],
      isError: true,
    };
  });

  // Register empty handlers for resources and prompts (to be implemented)
  mcpServer.setRequestHandler(ListResourcesRequestSchema, async () => {
    return { resources: [] };
  });

  mcpServer.setRequestHandler(ReadResourceRequestSchema, async () => {
    return {
      contents: [{ uri: '', mimeType: 'text/plain', text: '' }],
    };
  });

  mcpServer.setRequestHandler(ListPromptsRequestSchema, async () => {
    return { prompts: [] };
  });

  mcpServer.setRequestHandler(GetPromptRequestSchema, async () => {
    return {
      messages: [{ role: 'user', content: { type: 'text', text: '' } }],
    };
  });

  // Connect to stdio transport
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    await app.close();
    process.exit(0);
  });
}

bootstrap().catch((error) => {
  console.error('Failed to start PM Server:', error);
  process.exit(1);
});
