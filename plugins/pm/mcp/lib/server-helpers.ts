/**
 * MCP Server Helper Functions
 *
 * Pure functions extracted from server.ts for testability.
 */

import { execSync, execFileSync } from "child_process";

// ============================================
// Commit Message Parsing
// ============================================

export interface ParsedCommitMessage {
  type?: string;
  scope?: string;
  description: string;
  breaking: boolean;
  magicWords: { action: string; issueIds: number[] }[];
}

/**
 * Parse a commit message in Conventional Commits format
 * Also extracts magic words for issue linking (LEVEL_1 Section 3)
 */
export function parseCommitMessage(message: string): ParsedCommitMessage {
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

// ============================================
// Branch Name Helpers
// ============================================

export interface ParsedBranchName {
  taskId?: string;
  type?: string;
  description?: string;
  format?: "level1" | "legacy";
}

/**
 * Parse a branch name in LEVEL_1 format: {issue_id}-{type}-{description}
 * Also supports legacy PM-123 format
 */
export function parseBranchName(branch: string): ParsedBranchName {
  // LEVEL_1 format: {issue_id}-{type}-{description}
  const match = branch.match(/^([a-f0-9-]+)-(\w+)-(.+)$/);
  if (match) {
    return {
      taskId: match[1],
      type: match[2],
      description: match[3],
      format: "level1",
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

/**
 * Generate a branch name in LEVEL_1 format
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

// ============================================
// Git Operations
// ============================================

/**
 * Get current git branch name
 */
export function getCurrentBranch(): string | null {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return null;
  }
}

/**
 * Get git repository status
 */
export function getGitStatus(): {
  branch?: string;
  hasChanges?: boolean;
  changedFiles?: number;
  unpushedCommits?: number;
  error?: string;
} {
  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    const status = execSync("git status --porcelain", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    let unpushedCount = 0;
    try {
      const unpushed = execSync("git log @{u}..HEAD --oneline", {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();
      unpushedCount = unpushed ? unpushed.split("\n").filter(Boolean).length : 0;
    } catch {
      // No upstream branch
      unpushedCount = 0;
    }

    return {
      branch,
      hasChanges: status.length > 0,
      changedFiles: status.split("\n").filter(Boolean).length,
      unpushedCommits: unpushedCount,
    };
  } catch {
    return { error: "Not a git repository" };
  }
}

/**
 * Get git commit statistics
 * Uses execFileSync to prevent shell injection
 */
export function getGitStats(
  from?: string,
  to?: string,
  author?: string
): {
  range: string;
  commits: number;
  linesAdded: number;
  linesDeleted: number;
  recentCommits: { sha: string; author: string; email: string; message: string }[];
  error?: string;
} {
  try {
    const range =
      from && to ? `${from}..${to}` : from ? `${from}..HEAD` : "HEAD~30..HEAD";

    // Build args array to prevent shell injection
    const args = ["log", range, "--shortstat", "--format=%H|%an|%ae|%s"];
    if (author) {
      args.push(`--author=${author}`);
    }

    const log = execFileSync("git", args, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });

    const commits: {
      sha: string;
      author: string;
      email: string;
      message: string;
    }[] = [];
    let totalAdded = 0;
    let totalDeleted = 0;

    const lines = log.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes("|")) {
        const [sha, authorName, email, message] = line.split("|");
        commits.push({
          sha: sha.slice(0, 7),
          author: authorName,
          email,
          message,
        });
      } else if (line.includes("insertion") || line.includes("deletion")) {
        const insertMatch = line.match(/(\d+) insertion/);
        const deleteMatch = line.match(/(\d+) deletion/);
        totalAdded += insertMatch ? parseInt(insertMatch[1], 10) : 0;
        totalDeleted += deleteMatch ? parseInt(deleteMatch[1], 10) : 0;
      }
    }

    return {
      range,
      commits: commits.length,
      linesAdded: totalAdded,
      linesDeleted: totalDeleted,
      recentCommits: commits.slice(0, 10),
    };
  } catch {
    return {
      range: "",
      commits: 0,
      linesAdded: 0,
      linesDeleted: 0,
      recentCommits: [],
      error: "Git stats failed",
    };
  }
}

/**
 * Get frequently changed files (hotspots)
 * Uses execFileSync to prevent shell injection
 */
export function getGitHotspots(
  limit: number = 10
): { file: string; changes: number; risk: string }[] {
  try {
    // Validate limit to prevent issues
    const safeLimit = Math.max(1, Math.min(Math.floor(limit), 100));

    // Get file names from git log using execFileSync (safe)
    const gitOutput = execFileSync(
      "git",
      ["log", "--pretty=format:", "--name-only", "HEAD~100..HEAD"],
      {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      }
    );

    // Process in JavaScript instead of shell pipeline
    const fileCount = new Map<string, number>();
    gitOutput
      .split("\n")
      .filter(Boolean)
      .forEach((file) => {
        fileCount.set(file, (fileCount.get(file) || 0) + 1);
      });

    // Sort by count and take top N
    const sorted = Array.from(fileCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, safeLimit);

    return sorted.map(([file, changes]) => ({
      file,
      changes,
      risk: changes > 20 ? "high" : changes > 10 ? "medium" : "low",
    }));
  } catch {
    return [];
  }
}

/**
 * Check if we're in a git repository
 */
export function isGitRepository(): boolean {
  try {
    execFileSync("git", ["rev-parse", "--git-dir"], {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the root directory of the git repository
 */
export function getGitRoot(): string | null {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return null;
  }
}

/**
 * Get the status change implied by magic words
 */
export function getMagicWordStatusChange(
  magicWords: { action: string; issueIds: number[] }[]
): Map<number, string> {
  const changes = new Map<number, string>();

  for (const mw of magicWords) {
    for (const issueId of mw.issueIds) {
      switch (mw.action) {
        case "fixes":
        case "closes":
        case "done":
          changes.set(issueId, "done");
          break;
        case "wip":
          changes.set(issueId, "in_progress");
          break;
        case "review":
          changes.set(issueId, "in_review");
          break;
        // refs, blocks, depends don't change status
      }
    }
  }

  return changes;
}

// ============================================
// Resource Content Builders
// ============================================

export const TASK_SCHEMA = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    title: { type: "string", minLength: 1 },
    description: { type: "string" },
    status: {
      type: "string",
      enum: ["todo", "in_progress", "in_review", "done", "blocked"],
    },
    priority: {
      type: "string",
      enum: ["critical", "high", "medium", "low"],
    },
    type: {
      type: "string",
      enum: ["epic", "story", "task", "bug", "subtask"],
    },
    estimatePoints: { type: "integer", minimum: 0 },
    estimateHours: { type: "number", minimum: 0 },
    sprintId: { type: "string", format: "uuid" },
    assignee: { type: "string" },
    labels: { type: "array", items: { type: "string" } },
    dueDate: { type: "string", format: "date" },
  },
  required: ["title"],
};

export const SPRINT_SCHEMA = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    name: { type: "string", minLength: 1 },
    goal: { type: "string" },
    startDate: { type: "string", format: "date" },
    endDate: { type: "string", format: "date" },
    status: {
      type: "string",
      enum: ["planning", "active", "completed", "cancelled"],
    },
  },
  required: ["name", "startDate", "endDate"],
};

export const VELOCITY_METHOD_TEXT = `Velocity Calculation Method:
- Unit: Story Points
- Window: Last 3 sprints rolling average
- Formula: SUM(completed_points) / sprint_count
- Confidence: Standard deviation of last 5 sprints`;

export const PM_CONVENTIONS_MD = `# PM Conventions

## Task Naming
- Use imperative mood: "Add feature" not "Added feature"
- Be specific: "Implement user authentication" not "Auth"

## Story Points
- 1: Trivial (< 1 hour)
- 2: Small (half day)
- 3: Medium (1 day)
- 5: Large (2-3 days)
- 8: Very Large (1 week)
- 13: Epic (needs breakdown)

## Git Branch Naming (LEVEL_1)
- Format: {issue_number}-{type}-{description}
- Types: feat, fix, refactor, docs, test, chore
- Example: 42-feat-user-authentication

## Commit Messages (Conventional Commits)
- Format: <type>(<scope>): <description> [#issue]
- Types: feat, fix, docs, style, refactor, test, chore
- Magic Words: fixes #42, closes #42, refs #42

## Status Transitions
- todo → in_progress (branch created)
- in_progress → in_review (PR created)
- in_review → done (PR merged with fixes/closes)
`;

// ============================================
// Tool Input Schemas
// ============================================

export const TOOL_SCHEMAS = {
  pm_project_create: {
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
  pm_project_list: {
    name: "pm_project_list",
    description: "List all projects",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  pm_task_create: {
    name: "pm_task_create",
    description: "Create a new task",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Task title" },
        description: { type: "string", description: "Task description" },
        projectId: { type: "string", description: "Project ID" },
        type: {
          type: "string",
          enum: ["epic", "story", "task", "bug", "subtask"],
          default: "task",
        },
        priority: {
          type: "string",
          enum: ["critical", "high", "medium", "low"],
          default: "medium",
        },
        estimatePoints: { type: "integer", description: "Story points" },
        sprintId: { type: "string", description: "Sprint to add task to" },
      },
      required: ["title", "projectId"],
    },
  },
  pm_task_list: {
    name: "pm_task_list",
    description: "List tasks with optional filtering",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        sprintId: { type: "string" },
        status: { type: "string" },
        assignee: { type: "string" },
        type: { type: "string" },
        priority: { type: "string" },
        limit: { type: "integer", default: 50 },
        offset: { type: "integer", default: 0 },
      },
    },
  },
  pm_task_get: {
    name: "pm_task_get",
    description: "Get a specific task by ID",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "string", description: "Task ID" },
      },
      required: ["taskId"],
    },
  },
  pm_task_update: {
    name: "pm_task_update",
    description: "Update a task",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        status: { type: "string" },
        priority: { type: "string" },
        estimatePoints: { type: "integer" },
        assignee: { type: "string" },
      },
      required: ["taskId"],
    },
  },
  pm_task_status: {
    name: "pm_task_status",
    description: "Change task status",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "string" },
        status: {
          type: "string",
          enum: ["todo", "in_progress", "in_review", "done", "blocked"],
        },
        reason: { type: "string", description: "Reason for status change" },
      },
      required: ["taskId", "status"],
    },
  },
  pm_task_board: {
    name: "pm_task_board",
    description: "Get task board view grouped by status",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        sprintId: { type: "string" },
      },
      required: ["projectId"],
    },
  },
  pm_sprint_create: {
    name: "pm_sprint_create",
    description: "Create a new sprint",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        projectId: { type: "string" },
        startDate: { type: "string", format: "date" },
        endDate: { type: "string", format: "date" },
        goal: { type: "string" },
      },
      required: ["name", "projectId", "startDate", "endDate"],
    },
  },
  pm_sprint_list: {
    name: "pm_sprint_list",
    description: "List sprints for a project",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
      },
      required: ["projectId"],
    },
  },
  pm_sprint_status: {
    name: "pm_sprint_status",
    description: "Get sprint status with task breakdown",
    inputSchema: {
      type: "object",
      properties: {
        sprintId: { type: "string" },
      },
      required: ["sprintId"],
    },
  },
  pm_sprint_start: {
    name: "pm_sprint_start",
    description: "Start a sprint",
    inputSchema: {
      type: "object",
      properties: {
        sprintId: { type: "string" },
      },
      required: ["sprintId"],
    },
  },
  pm_sprint_complete: {
    name: "pm_sprint_complete",
    description: "Complete a sprint and record velocity",
    inputSchema: {
      type: "object",
      properties: {
        sprintId: { type: "string" },
      },
      required: ["sprintId"],
    },
  },
  pm_sprint_add_tasks: {
    name: "pm_sprint_add_tasks",
    description: "Add tasks to a sprint",
    inputSchema: {
      type: "object",
      properties: {
        sprintId: { type: "string" },
        taskIds: { type: "array", items: { type: "string" } },
      },
      required: ["sprintId", "taskIds"],
    },
  },
  pm_velocity_calculate: {
    name: "pm_velocity_calculate",
    description: "Calculate velocity for a project",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        sprintCount: { type: "integer", default: 3 },
      },
      required: ["projectId"],
    },
  },
  pm_burndown_data: {
    name: "pm_burndown_data",
    description: "Get burndown chart data for a sprint",
    inputSchema: {
      type: "object",
      properties: {
        sprintId: { type: "string" },
      },
      required: ["sprintId"],
    },
  },
  pm_git_branch_create: {
    name: "pm_git_branch_create",
    description: "Create a branch for a task (LEVEL_1 format)",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "string" },
        type: {
          type: "string",
          enum: ["feat", "fix", "refactor", "docs", "test", "chore"],
          default: "feat",
        },
      },
      required: ["taskId"],
    },
  },
  pm_git_commit_link: {
    name: "pm_git_commit_link",
    description: "Link a commit to a task",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "string" },
        commitSha: { type: "string" },
        branch: { type: "string" },
        message: { type: "string" },
      },
      required: ["taskId", "commitSha"],
    },
  },
  pm_git_parse_branch: {
    name: "pm_git_parse_branch",
    description: "Parse current branch to extract task info",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  pm_git_parse_commit: {
    name: "pm_git_parse_commit",
    description: "Parse a commit message for magic words",
    inputSchema: {
      type: "object",
      properties: {
        message: { type: "string" },
      },
      required: ["message"],
    },
  },
  pm_git_stats: {
    name: "pm_git_stats",
    description: "Get git commit statistics",
    inputSchema: {
      type: "object",
      properties: {
        from: { type: "string", description: "Start date or ref" },
        to: { type: "string", description: "End date or ref" },
        author: { type: "string", description: "Filter by author" },
      },
    },
  },
  pm_git_hotspots: {
    name: "pm_git_hotspots",
    description: "Find frequently changed files (risk indicators)",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "integer", default: 10 },
      },
    },
  },
};

// ============================================
// Prompt Templates
// ============================================

export function getSprintPlanningPrompt(
  sprintName: string,
  duration: number = 14
): string {
  return `# Sprint Planning: ${sprintName}

## Agenda
1. Review velocity from previous sprints
2. Discuss sprint goal
3. Select and estimate backlog items
4. Capacity planning
5. Commitment

## Steps
1. First, use pm_velocity_calculate to get team velocity
2. Review the product backlog with pm_task_list
3. For each selected item, ensure it has story points
4. Add tasks to sprint with pm_sprint_add_tasks
5. Verify total points don't exceed velocity

Duration: ${duration} days

Let's start by calculating the team's velocity.`;
}

export function getRetrospectivePrompt(sprintId: string): string {
  return `# Sprint Retrospective

## Sprint: ${sprintId}

## Format: Start-Stop-Continue

### What went well? (Continue)
-

### What didn't go well? (Stop)
-

### What should we try? (Start)
-

## Action Items
- [ ]

## Analysis Steps
1. Use pm_sprint_status to get completion metrics
2. Use pm_velocity_calculate to compare with historical
3. Use pm_git_stats to analyze commit patterns
4. Use pm_git_hotspots to identify risk areas
5. Review blocked tasks and resolution time

Let's start by getting the sprint status.`;
}

export function getDailyStandupPrompt(): string {
  return `# Daily Standup

## Format
For each team member:
1. What did you complete yesterday?
2. What will you work on today?
3. Any blockers?

## Quick Status Check
Use pm_task_board to see current sprint board:
- In Progress tasks
- Blocked tasks
- Recently completed

Let's get the current sprint board.`;
}

export function getRiskAssessmentPrompt(projectId: string): string {
  return `# Risk Assessment: ${projectId}

## Analysis Areas
1. **Code Hotspots**: Files with high change frequency + complexity
2. **Blocked Tasks**: Tasks stuck in blocked status
3. **Sprint Progress**: Behind schedule indicators
4. **Technical Debt**: Accumulating issues

## Steps
1. Use pm_git_hotspots to find risky files
2. Use pm_task_list with status=blocked
3. Use pm_sprint_status for current sprint
4. Review tasks marked as technical debt

Let's start with hotspot analysis.`;
}

export function getReleasePlanPrompt(version?: string): string {
  return `# Release Planning

## Target Version: ${version || "Next"}

## Steps
1. Review completed tasks since last release
2. Analyze git commits for changelog
3. Identify breaking changes
4. Generate release notes

## Commands
1. pm_git_stats to see commit summary
2. pm_task_list with status=done for completed work
3. Review Conventional Commits for version bump type

Let's analyze the changes since the last release.`;
}

// ============================================
// Burndown Chart Helper
// ============================================

export function formatBurndownChart(
  burndown: { date: string; remaining_points: number; ideal_points: number }[]
): string {
  if (burndown.length === 0) return "";

  const maxPoints = burndown[0].remaining_points;
  if (maxPoints === 0) return "No points to burn down";

  return burndown
    .map((point) => {
      const remainingBar = "█".repeat(
        Math.round((point.remaining_points / maxPoints) * 20)
      );
      return `${point.date.slice(5)}: ${remainingBar.padEnd(20)} ${point.remaining_points}/${point.ideal_points}`;
    })
    .join("\n");
}
