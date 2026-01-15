/**
 * PM Plugin MCP Server (Simplified)
 *
 * Focus: Local Task → GitHub Issue → GitHub Project workflow
 *
 * Core Features:
 * - Task CRUD operations
 * - GitHub Issue integration
 * - GitHub Projects integration
 * - Event sourcing for audit trail
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { EventStore, createTaskEvent } from "../storage/lib/events.js";
import { getDatabase, DatabaseManager } from "./lib/db.js";
import {
  ProjectRepository,
  TaskRepository,
  ProjectConfigRepository,
} from "./lib/projections.js";
import {
  getRepoInfo,
  isAuthenticated,
  getIssue,
  createIssue as createGitHubIssue,
} from "../lib/github.js";
import { randomUUID } from "crypto";

// ============================================
// Server Configuration
// ============================================

const DB_PATH = process.env.PM_DB_PATH || ".claude/pm.db";

const server = new Server(
  {
    name: "pm-server",
    version: "2.0.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  }
);

let eventStore: EventStore;
let dbManager: DatabaseManager;
let projectRepo: ProjectRepository;
let taskRepo: TaskRepository;
let configRepo: ProjectConfigRepository;

// ============================================
// Resources
// ============================================

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: "pm://schema/task",
        mimeType: "application/json",
        name: "Task Schema",
        description: "Task entity schema definition",
      },
      {
        uri: "pm://schema/project",
        mimeType: "application/json",
        name: "Project Schema",
        description: "Project entity schema definition",
      },
      {
        uri: "pm://config",
        mimeType: "application/json",
        name: "Project Configuration",
        description: "Current project configuration",
      },
    ],
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri.toString();

  if (uri === "pm://schema/task") {
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(
            {
              id: "string (UUID)",
              seq: "number (project-scoped, e.g., #42)",
              project_id: "string (UUID)",
              title: "string",
              description: "string?",
              status: "'todo' | 'in_progress' | 'in_review' | 'done' | 'blocked'",
              priority: "'critical' | 'high' | 'medium' | 'low'",
              type: "'epic' | 'story' | 'task' | 'bug' | 'subtask'",
              estimate_points: "number?",
              github_issue_number: "number?",
              github_issue_url: "string?",
              created_at: "string (ISO 8601)",
            },
            null,
            2
          ),
        },
      ],
    };
  }

  if (uri === "pm://schema/project") {
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(
            {
              id: "string (UUID)",
              name: "string",
              description: "string?",
              status: "'active' | 'archived' | 'completed'",
              created_at: "string (ISO 8601)",
            },
            null,
            2
          ),
        },
      ],
    };
  }

  if (uri === "pm://config") {
    const projects = projectRepo.list();
    const configs = projects.map((p) => ({
      project: p.name,
      github: configRepo.getByProjectId(p.id),
    }));

    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(configs, null, 2),
        },
      ],
    };
  }

  throw new Error(`Unknown resource: ${uri}`);
});

// ============================================
// Tools
// ============================================

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // Project Tools
      {
        name: "pm_project_create",
        description: "Create a new project",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Project name" },
            description: { type: "string", description: "Project description" },
          },
          required: ["name"],
        },
      },
      {
        name: "pm_project_list",
        description: "List all projects",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },

      // Task Tools
      {
        name: "pm_task_create",
        description: "Create a new task",
        inputSchema: {
          type: "object",
          properties: {
            title: { type: "string", description: "Task title" },
            projectId: { type: "string", description: "Project UUID" },
            description: { type: "string", description: "Task description" },
            type: {
              type: "string",
              enum: ["epic", "story", "task", "bug", "subtask"],
              description: "Task type",
            },
            priority: {
              type: "string",
              enum: ["critical", "high", "medium", "low"],
              description: "Task priority",
            },
            estimatePoints: { type: "number", description: "Story points estimate" },
          },
          required: ["title", "projectId"],
        },
      },
      {
        name: "pm_task_list",
        description: "List tasks with optional filters",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "string", description: "Filter by project" },
            status: { type: "string", description: "Filter by status" },
            type: { type: "string", description: "Filter by type" },
            priority: { type: "string", description: "Filter by priority" },
            limit: { type: "number", description: "Max results" },
          },
        },
      },
      {
        name: "pm_task_get",
        description: "Get task by ID or #seq",
        inputSchema: {
          type: "object",
          properties: {
            taskId: { type: "string", description: "Task UUID or #seq" },
            projectId: { type: "string", description: "Required if using #seq" },
          },
          required: ["taskId"],
        },
      },
      {
        name: "pm_task_update",
        description: "Update task fields",
        inputSchema: {
          type: "object",
          properties: {
            taskId: { type: "string", description: "Task UUID" },
            title: { type: "string" },
            description: { type: "string" },
            status: { type: "string" },
            priority: { type: "string" },
            type: { type: "string" },
            estimatePoints: { type: "number" },
            assignee: { type: "string" },
          },
          required: ["taskId"],
        },
      },
      {
        name: "pm_task_status",
        description: "Change task status (creates event)",
        inputSchema: {
          type: "object",
          properties: {
            taskId: { type: "string", description: "Task UUID" },
            status: {
              type: "string",
              enum: ["todo", "in_progress", "in_review", "done", "blocked"],
            },
            reason: { type: "string", description: "Reason for status change" },
          },
          required: ["taskId", "status"],
        },
      },

      // GitHub Integration Tools
      {
        name: "pm_github_issue_create",
        description: "Create GitHub Issue from task and link them",
        inputSchema: {
          type: "object",
          properties: {
            taskId: { type: "string", description: "Task UUID" },
            labels: {
              type: "array",
              items: { type: "string" },
              description: "GitHub labels",
            },
          },
          required: ["taskId"],
        },
      },
      {
        name: "pm_github_issue_link",
        description: "Link existing GitHub Issue to task",
        inputSchema: {
          type: "object",
          properties: {
            taskId: { type: "string", description: "Task UUID" },
            issueNumber: { type: "number", description: "GitHub Issue #" },
          },
          required: ["taskId", "issueNumber"],
        },
      },
      {
        name: "pm_github_config",
        description: "Configure GitHub integration for project",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "string", description: "Project UUID" },
            githubRepo: { type: "string", description: "owner/repo format" },
            githubProjectNumber: { type: "number", description: "GitHub Projects V2 number" },
            syncMode: {
              type: "string",
              enum: ["manual", "auto"],
              description: "Sync mode",
            },
          },
          required: ["projectId"],
        },
      },
    ],
  };
});

// ============================================
// Tool Handlers
// ============================================

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      // ========== Project Tools ==========
      case "pm_project_create": {
        const project = projectRepo.create(args.name, args.description);
        return {
          content: [
            {
              type: "text",
              text: `✓ Project created: ${project.name} (${project.id})`,
            },
          ],
        };
      }

      case "pm_project_list": {
        const projects = projectRepo.list();
        return {
          content: [
            {
              type: "text",
              text: projects.length === 0
                ? "No projects found. Create one with pm_project_create."
                : projects.map((p) => `- ${p.name} (${p.status})`).join("\n"),
            },
          ],
        };
      }

      // ========== Task Tools ==========
      case "pm_task_create": {
        const taskId = randomUUID();
        createTaskEvent(eventStore, "TaskCreated", taskId, {
          title: args.title,
          projectId: args.projectId,
          description: args.description,
          type: args.type || "task",
          priority: args.priority || "medium",
          estimatePoints: args.estimatePoints,
        });

        const task = taskRepo.syncFromEvents(taskId);
        return {
          content: [
            {
              type: "text",
              text: task
                ? `✓ Task created: #${task.seq} - ${task.title}`
                : "Failed to create task",
            },
          ],
        };
      }

      case "pm_task_list": {
        const tasks = taskRepo.list({
          projectId: args.projectId,
          status: args.status,
          type: args.type,
          priority: args.priority,
          limit: args.limit || 50,
        });

        if (tasks.length === 0) {
          return {
            content: [{ type: "text", text: "No tasks found" }],
          };
        }

        const grouped = tasks.reduce((acc, t) => {
          if (!acc[t.status]) acc[t.status] = [];
          acc[t.status].push(t);
          return acc;
        }, {} as Record<string, typeof tasks>);

        const output = Object.entries(grouped)
          .map(([status, statusTasks]) => {
            const header = `\n${status.toUpperCase()} (${statusTasks.length})`;
            const taskList = statusTasks
              .map(
                (t) =>
                  `  #${t.seq} [${t.priority}] ${t.title}${
                    t.github_issue_number ? ` (GH #${t.github_issue_number})` : ""
                  }`
              )
              .join("\n");
            return `${header}\n${taskList}`;
          })
          .join("\n");

        return {
          content: [{ type: "text", text: output }],
        };
      }

      case "pm_task_get": {
        let task;
        if (args.taskId.startsWith("#")) {
          const seq = parseInt(args.taskId.substring(1));
          if (!args.projectId) {
            throw new Error("projectId required when using #seq");
          }
          task = taskRepo.getBySeq(args.projectId, seq);
        } else {
          task = taskRepo.getById(args.taskId);
        }

        if (!task) {
          return {
            content: [{ type: "text", text: `Task not found: ${args.taskId}` }],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(task, null, 2),
            },
          ],
        };
      }

      case "pm_task_update": {
        const task = taskRepo.update(args.taskId, args);
        if (!task) {
          return {
            content: [{ type: "text", text: `Task not found: ${args.taskId}` }],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: "text",
              text: `✓ Task updated: #${task.seq} - ${task.title}`,
            },
          ],
        };
      }

      case "pm_task_status": {
        const task = taskRepo.getById(args.taskId);
        if (!task) {
          return {
            content: [{ type: "text", text: `Task not found: ${args.taskId}` }],
            isError: true,
          };
        }

        createTaskEvent(eventStore, "TaskStatusChanged", args.taskId, {
          status: args.status,
          reason: args.reason,
          previousStatus: task.status,
        });

        const updated = taskRepo.syncFromEvents(args.taskId);
        return {
          content: [
            {
              type: "text",
              text: `✓ Task #${updated?.seq}: ${task.status} → ${args.status}`,
            },
          ],
        };
      }

      // ========== GitHub Tools ==========
      case "pm_github_issue_create": {
        const task = taskRepo.getById(args.taskId);
        if (!task) {
          return {
            content: [{ type: "text", text: `Task not found: ${args.taskId}` }],
            isError: true,
          };
        }

        // Check GitHub authentication
        if (!(await isAuthenticated())) {
          return {
            content: [
              {
                type: "text",
                text: "❌ GitHub not authenticated. Run: gh auth login",
              },
            ],
            isError: true,
          };
        }

        // Get project config
        const config = configRepo.getByProjectId(task.project_id);
        if (!config || !config.github_repo) {
          return {
            content: [
              {
                type: "text",
                text: "❌ GitHub not configured for this project. Use pm_github_config first.",
              },
            ],
            isError: true,
          };
        }

        // Create GitHub Issue
        const issue = await createGitHubIssue({
          repo: config.github_repo,
          title: task.title,
          body: task.description || "",
          labels: args.labels || [],
        });

        // Link issue to task
        taskRepo.update(args.taskId, {
          github_issue_number: issue.number,
          github_issue_url: issue.html_url,
        });

        return {
          content: [
            {
              type: "text",
              text: `✓ Created GitHub Issue #${issue.number}\n${issue.html_url}\n\nLinked to task #${task.seq}`,
            },
          ],
        };
      }

      case "pm_github_issue_link": {
        const task = taskRepo.getById(args.taskId);
        if (!task) {
          return {
            content: [{ type: "text", text: `Task not found: ${args.taskId}` }],
            isError: true,
          };
        }

        // Get project config
        const config = configRepo.getByProjectId(task.project_id);
        if (!config || !config.github_repo) {
          return {
            content: [
              {
                type: "text",
                text: "❌ GitHub not configured for this project",
              },
            ],
            isError: true,
          };
        }

        // Fetch issue to get URL
        const issue = await getIssue(config.github_repo, args.issueNumber);
        if (!issue) {
          return {
            content: [
              {
                type: "text",
                text: `❌ GitHub Issue #${args.issueNumber} not found`,
              },
            ],
            isError: true,
          };
        }

        taskRepo.update(args.taskId, {
          github_issue_number: issue.number,
          github_issue_url: issue.html_url,
        });

        return {
          content: [
            {
              type: "text",
              text: `✓ Linked task #${task.seq} to GitHub Issue #${issue.number}`,
            },
          ],
        };
      }

      case "pm_github_config": {
        const project = projectRepo.getById(args.projectId);
        if (!project) {
          return {
            content: [{ type: "text", text: "Project not found" }],
            isError: true,
          };
        }

        let config = configRepo.getByProjectId(args.projectId);
        if (!config) {
          config = configRepo.create(args.projectId, {
            github_enabled: true,
            github_repo: args.githubRepo,
            github_project_number: args.githubProjectNumber,
            sync_mode: args.syncMode || "manual",
          });
        } else {
          config = configRepo.update(args.projectId, {
            github_enabled: true,
            github_repo: args.githubRepo,
            github_project_number: args.githubProjectNumber,
            sync_mode: args.syncMode,
          })!;
        }

        return {
          content: [
            {
              type: "text",
              text: `✓ GitHub configured for ${project.name}\nRepo: ${config.github_repo}\nSync: ${config.sync_mode}`,
            },
          ],
        };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    console.error(`Error in ${name}:`, error);
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

// ============================================
// Server Initialization
// ============================================

async function main() {
  // Initialize database
  dbManager = getDatabase(DB_PATH);
  dbManager.initSchema();

  // Initialize event store
  eventStore = new EventStore(dbManager);

  // Initialize repositories
  projectRepo = new ProjectRepository(dbManager, eventStore);
  taskRepo = new TaskRepository(dbManager, eventStore);
  configRepo = new ProjectConfigRepository(dbManager);

  // Start server
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("PM Plugin MCP Server v2.0.0 running");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
