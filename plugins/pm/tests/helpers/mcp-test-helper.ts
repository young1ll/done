/**
 * MCP Server Test Helper
 *
 * Provides utilities for testing MCP server handlers directly.
 */

import { EventStore } from "../../storage/lib/events.js";
import { DatabaseManager } from "../../mcp/lib/db.js";
import {
  ProjectRepository,
  SprintRepository,
  TaskRepository,
  AnalyticsRepository,
} from "../../mcp/lib/projections.js";

export interface TestContext {
  eventStore: EventStore;
  dbManager: DatabaseManager;
  projectRepo: ProjectRepository;
  sprintRepo: SprintRepository;
  taskRepo: TaskRepository;
  analyticsRepo: AnalyticsRepository;
}

/**
 * Creates an in-memory test context with all repositories
 * Uses a single shared database connection for both projections and events
 */
export function createTestContext(): TestContext {
  // Use in-memory database
  const dbManager = new DatabaseManager(":memory:");

  // Initialize schema for projections
  initializeProjectionsSchema(dbManager);

  // Share the same database instance with EventStore
  // This ensures events and projections use the same database
  const eventStore = new EventStore(dbManager.getDb(), true);

  // Create repositories
  const projectRepo = new ProjectRepository(dbManager, eventStore);
  const sprintRepo = new SprintRepository(dbManager, eventStore);
  const taskRepo = new TaskRepository(dbManager, eventStore);
  const analyticsRepo = new AnalyticsRepository(dbManager);

  return {
    eventStore,
    dbManager,
    projectRepo,
    sprintRepo,
    taskRepo,
    analyticsRepo,
  };
}

/**
 * Clean up test context
 * Only closes dbManager since EventStore shares the same DB connection
 */
export function cleanupTestContext(ctx: TestContext): void {
  try {
    // Only close dbManager - EventStore shares the same connection
    ctx.dbManager.close();
  } catch {
    // Already closed
  }
}

/**
 * Initialize projections schema for testing
 * (Matches storage/schema.sql and projections.ts interfaces)
 */
function initializeProjectionsSchema(db: DatabaseManager): void {
  db.getDb().exec(`
    -- Projects table (matches Project interface in projections.ts)
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'active',
      settings TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Sprints table (matches Sprint interface in projections.ts)
    CREATE TABLE IF NOT EXISTS sprints (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      name TEXT NOT NULL,
      goal TEXT,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      status TEXT DEFAULT 'planning',
      velocity_committed INTEGER DEFAULT 0,
      velocity_completed INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT
    );

    -- Tasks table (matches Task interface in projections.ts)
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      seq INTEGER,
      project_id TEXT REFERENCES projects(id),
      sprint_id TEXT REFERENCES sprints(id),
      parent_id TEXT REFERENCES tasks(id),
      title TEXT NOT NULL,
      description TEXT,
      type TEXT DEFAULT 'task',
      status TEXT DEFAULT 'todo',
      priority TEXT DEFAULT 'medium',
      estimate_points INTEGER,
      estimate_hours REAL,
      actual_hours REAL,
      assignee TEXT,
      labels TEXT,
      due_date TEXT,
      blocked_by TEXT,
      branch_name TEXT,
      linked_commits TEXT,
      linked_prs TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      started_at TEXT,
      completed_at TEXT
    );

    -- Sprint tasks junction (for backlog management)
    CREATE TABLE IF NOT EXISTS sprint_tasks (
      sprint_id TEXT NOT NULL REFERENCES sprints(id),
      task_id TEXT NOT NULL REFERENCES tasks(id),
      added_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (sprint_id, task_id)
    );

    -- Velocity history (used by SprintRepository.complete and AnalyticsRepository)
    CREATE TABLE IF NOT EXISTS velocity_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL REFERENCES projects(id),
      sprint_id TEXT NOT NULL REFERENCES sprints(id),
      committed_points INTEGER DEFAULT 0,
      completed_points INTEGER DEFAULT 0,
      completion_rate REAL DEFAULT 0,
      recorded_at TEXT DEFAULT (datetime('now'))
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_sprint ON tasks(sprint_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_sprints_project ON sprints(project_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_project_seq ON tasks(project_id, seq);
  `);
}

/**
 * Parse commit message (replica of server function for testing)
 */
export function parseCommitMessage(message: string): {
  type?: string;
  scope?: string;
  description: string;
  breaking: boolean;
  magicWords: { action: string; issueIds: number[] }[];
} {
  // Parse Conventional Commits format
  const conventionalMatch = message.match(
    /^(\w+)(?:\(([^)]+)\))?(!)?:\s*(.+)/
  );

  const type = conventionalMatch?.[1];
  const scope = conventionalMatch?.[2];
  const breaking =
    conventionalMatch?.[3] === "!" || message.includes("BREAKING CHANGE");
  const description = conventionalMatch?.[4] || message;

  // Parse magic words (LEVEL_1 Section 3)
  const magicWords: { action: string; issueIds: number[] }[] = [];

  const patterns = [
    { action: "fixes", pattern: /\b(?:fixes?|closes?|resolves?)\s+#(\d+)/gi },
    { action: "refs", pattern: /\b(?:refs?|relates?)\s+#(\d+)/gi },
    { action: "blocks", pattern: /\bblocks?\s+#(\d+)/gi },
    { action: "depends", pattern: /\bdepends?\s+#(\d+)/gi },
    { action: "wip", pattern: /\bwip\s+#(\d+)/gi },
    { action: "review", pattern: /\breview\s+#(\d+)/gi },
    { action: "done", pattern: /\bdone\s+#(\d+)/gi },
  ];

  for (const { action, pattern } of patterns) {
    const ids: number[] = [];
    let match;
    while ((match = pattern.exec(message)) !== null) {
      ids.push(parseInt(match[1], 10));
    }
    if (ids.length > 0) {
      magicWords.push({ action, issueIds: ids });
    }
  }

  return { type, scope, description, breaking, magicWords };
}

/**
 * Generate branch name in LEVEL_1 format
 */
export function generateBranchName(
  taskId: string,
  title: string,
  type: string = "feat"
): string {
  const description = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);

  return `${taskId.slice(0, 8)}-${type}-${description}`;
}

/**
 * Parse branch name in LEVEL_1 format
 */
export function parseBranchName(branch: string): {
  taskId?: string;
  type?: string;
  description?: string;
  format?: string;
} {
  // LEVEL_1 format: {issue_id}-{type}-{description}
  const match = branch.match(/^([a-f0-9-]+)-(\w+)-(.+)$/);
  if (match) {
    return {
      taskId: match[1],
      type: match[2],
      description: match[3],
    };
  }

  // Legacy PM-123 format
  const legacyMatch = branch.match(/^([A-Z]+-\d+)/);
  if (legacyMatch) {
    return {
      taskId: legacyMatch[1],
      format: "legacy",
    };
  }

  return {};
}
