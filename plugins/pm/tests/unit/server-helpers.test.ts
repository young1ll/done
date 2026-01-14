/**
 * MCP Server Helpers Unit Tests
 *
 * Tests for server-helpers.ts functions with mocked git commands.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { execSync, execFileSync } from "child_process";

// Mock child_process
vi.mock("child_process", () => ({
  execSync: vi.fn(),
  execFileSync: vi.fn(),
}));

// Import after mocking
import {
  parseCommitMessage,
  parseBranchName,
  generateBranchName,
  getCurrentBranch,
  getGitStatus,
  getGitStats,
  getGitHotspots,
  formatBurndownChart,
  getSprintPlanningPrompt,
  getRetrospectivePrompt,
  getDailyStandupPrompt,
  getRiskAssessmentPrompt,
  getReleasePlanPrompt,
  TASK_SCHEMA,
  SPRINT_SCHEMA,
  VELOCITY_METHOD_TEXT,
  PM_CONVENTIONS_MD,
  TOOL_SCHEMAS,
} from "../../mcp/lib/server-helpers.js";

const mockedExecSync = vi.mocked(execSync);
const mockedExecFileSync = vi.mocked(execFileSync);

describe("parseCommitMessage", () => {
  describe("Conventional Commits", () => {
    it("should parse feat commit", () => {
      const result = parseCommitMessage("feat: add new feature");
      expect(result.type).toBe("feat");
      expect(result.description).toBe("add new feature");
      expect(result.breaking).toBe(false);
    });

    it("should parse fix commit with scope", () => {
      const result = parseCommitMessage("fix(auth): resolve login issue");
      expect(result.type).toBe("fix");
      expect(result.scope).toBe("auth");
      expect(result.description).toBe("resolve login issue");
    });

    it("should detect breaking change with !", () => {
      const result = parseCommitMessage("feat!: breaking change");
      expect(result.breaking).toBe(true);
    });

    it("should detect breaking change with scope and !", () => {
      const result = parseCommitMessage("refactor(core)!: major refactor");
      expect(result.type).toBe("refactor");
      expect(result.scope).toBe("core");
      expect(result.breaking).toBe(true);
    });

    it("should detect BREAKING CHANGE in body", () => {
      const result = parseCommitMessage("feat: update\n\nBREAKING CHANGE: old API removed");
      expect(result.breaking).toBe(true);
    });

    it("should handle non-conventional message", () => {
      const result = parseCommitMessage("Updated readme");
      expect(result.type).toBeUndefined();
      expect(result.description).toBe("Updated readme");
    });
  });

  describe("Magic Words", () => {
    it("should parse fixes", () => {
      const result = parseCommitMessage("feat: add feature fixes #42");
      expect(result.magicWords).toHaveLength(1);
      expect(result.magicWords[0].action).toBe("fixes");
      expect(result.magicWords[0].issueIds).toContain(42);
    });

    it("should parse closes", () => {
      const result = parseCommitMessage("fix: bug closes #123");
      expect(result.magicWords[0].action).toBe("fixes");
      expect(result.magicWords[0].issueIds).toContain(123);
    });

    it("should parse resolves", () => {
      const result = parseCommitMessage("feat: feature resolves #456");
      expect(result.magicWords[0].action).toBe("fixes");
      expect(result.magicWords[0].issueIds).toContain(456);
    });

    it("should parse refs", () => {
      const result = parseCommitMessage("docs: update refs #100");
      expect(result.magicWords[0].action).toBe("refs");
      expect(result.magicWords[0].issueIds).toContain(100);
    });

    it("should parse relates", () => {
      const result = parseCommitMessage("chore: cleanup relates #200");
      expect(result.magicWords[0].action).toBe("refs");
    });

    it("should parse wip", () => {
      const result = parseCommitMessage("feat: partial wip #50");
      expect(result.magicWords[0].action).toBe("wip");
    });

    it("should parse review", () => {
      const result = parseCommitMessage("feat: ready review #75");
      expect(result.magicWords[0].action).toBe("review");
    });

    it("should parse done", () => {
      const result = parseCommitMessage("feat: completed done #99");
      expect(result.magicWords[0].action).toBe("done");
    });

    it("should parse blocks", () => {
      const result = parseCommitMessage("feat: feature blocks #10");
      expect(result.magicWords[0].action).toBe("blocks");
    });

    it("should parse depends", () => {
      const result = parseCommitMessage("feat: feature depends #20");
      expect(result.magicWords[0].action).toBe("depends");
    });

    it("should parse multiple issues", () => {
      const result = parseCommitMessage("feat: update fixes #1 fixes #2");
      expect(result.magicWords[0].issueIds).toEqual([1, 2]);
    });

    it("should parse multiple magic words", () => {
      const result = parseCommitMessage("feat: update refs #10 fixes #20");
      expect(result.magicWords).toHaveLength(2);
    });

    it("should handle no magic words", () => {
      const result = parseCommitMessage("feat: simple feature");
      expect(result.magicWords).toHaveLength(0);
    });
  });
});

describe("parseBranchName", () => {
  describe("LEVEL_1 format", () => {
    it("should parse feat branch", () => {
      const result = parseBranchName("550e8400-feat-add-auth");
      expect(result.taskId).toBe("550e8400");
      expect(result.type).toBe("feat");
      expect(result.description).toBe("add-auth");
      expect(result.format).toBe("level1");
    });

    it("should parse fix branch", () => {
      const result = parseBranchName("12345678-fix-login-bug");
      expect(result.type).toBe("fix");
      expect(result.format).toBe("level1");
    });

    it("should parse refactor branch", () => {
      const result = parseBranchName("abcd1234-refactor-auth");
      expect(result.type).toBe("refactor");
    });

    it("should parse docs branch", () => {
      const result = parseBranchName("11111111-docs-readme");
      expect(result.type).toBe("docs");
    });

    it("should parse test branch", () => {
      const result = parseBranchName("22222222-test-unit");
      expect(result.type).toBe("test");
    });

    it("should parse chore branch", () => {
      const result = parseBranchName("33333333-chore-deps");
      expect(result.type).toBe("chore");
    });
  });

  describe("Legacy format", () => {
    it("should parse PM-123 format", () => {
      const result = parseBranchName("PM-123-feature");
      expect(result.taskId).toBe("PM-123");
      expect(result.format).toBe("legacy");
    });

    it("should parse JIRA-456 format", () => {
      const result = parseBranchName("JIRA-456-bugfix");
      expect(result.taskId).toBe("JIRA-456");
      expect(result.format).toBe("legacy");
    });
  });

  describe("Invalid formats", () => {
    it("should return empty for main", () => {
      const result = parseBranchName("main");
      expect(result.taskId).toBeUndefined();
    });

    it("should return empty for develop", () => {
      const result = parseBranchName("develop");
      expect(result.taskId).toBeUndefined();
    });

    it("should return empty for random name", () => {
      const result = parseBranchName("some-random-branch");
      expect(result.taskId).toBeUndefined();
    });
  });
});

describe("generateBranchName", () => {
  it("should generate LEVEL_1 format", () => {
    const result = generateBranchName(
      "550e8400-e29b-41d4-a716-446655440000",
      "Add user authentication",
      "feat"
    );
    expect(result).toBe("550e8400-feat-add-user-authentication");
  });

  it("should use feat as default type", () => {
    const result = generateBranchName("12345678-abcd", "New feature");
    expect(result).toContain("-feat-");
  });

  it("should handle special characters", () => {
    const result = generateBranchName("12345678-abcd", "Fix bug: can't login!!!");
    expect(result).toBe("12345678-feat-fix-bug-can-t-login");
  });

  it("should truncate long descriptions", () => {
    const result = generateBranchName(
      "12345678-abcd",
      "This is a very long task title that exceeds thirty characters"
    );
    expect(result.length).toBeLessThanOrEqual(8 + 1 + 4 + 1 + 30);
  });

  it("should convert to lowercase", () => {
    const result = generateBranchName("12345678-abcd", "Add NEW Feature");
    expect(result).toBe("12345678-feat-add-new-feature");
  });
});

describe("getCurrentBranch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return branch name", () => {
    mockedExecSync.mockReturnValue("main\n");
    const result = getCurrentBranch();
    expect(result).toBe("main");
  });

  it("should return null on error", () => {
    mockedExecSync.mockImplementation(() => {
      throw new Error("Not a git repo");
    });
    const result = getCurrentBranch();
    expect(result).toBeNull();
  });
});

describe("getGitStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return git status", () => {
    mockedExecSync
      .mockReturnValueOnce("main\n") // branch
      .mockReturnValueOnce("M file.ts\n") // status
      .mockReturnValueOnce("commit1\ncommit2\n"); // unpushed

    const result = getGitStatus();

    expect(result.branch).toBe("main");
    expect(result.hasChanges).toBe(true);
    expect(result.changedFiles).toBe(1);
    expect(result.unpushedCommits).toBe(2);
  });

  it("should handle clean repo", () => {
    mockedExecSync
      .mockReturnValueOnce("main\n")
      .mockReturnValueOnce("")
      .mockReturnValueOnce("");

    const result = getGitStatus();

    expect(result.hasChanges).toBe(false);
    expect(result.changedFiles).toBe(0);
  });

  it("should handle no upstream branch", () => {
    mockedExecSync
      .mockReturnValueOnce("main\n")
      .mockReturnValueOnce("")
      .mockImplementationOnce(() => {
        throw new Error("No upstream");
      });

    const result = getGitStatus();

    expect(result.unpushedCommits).toBe(0);
  });

  it("should return error for non-git repo", () => {
    mockedExecSync.mockImplementation(() => {
      throw new Error("Not a git repo");
    });

    const result = getGitStatus();

    expect(result.error).toBe("Not a git repository");
  });
});

describe("getGitStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return git stats", () => {
    // Now uses execFileSync instead of execSync for security
    mockedExecFileSync.mockReturnValue(
      "abc1234|John|john@example.com|feat: feature\n" +
      " 10 insertions(+), 5 deletions(-)\n" +
      "def5678|Jane|jane@example.com|fix: bug\n" +
      " 3 insertions(+), 2 deletions(-)\n"
    );

    const result = getGitStats();

    expect(result.commits).toBe(2);
    expect(result.linesAdded).toBe(13);
    expect(result.linesDeleted).toBe(7);
    expect(result.recentCommits).toHaveLength(2);
  });

  it("should use default range", () => {
    mockedExecFileSync.mockReturnValue("");
    getGitStats();

    // execFileSync is called with (command, args, options)
    const args = mockedExecFileSync.mock.calls[0][1] as string[];
    expect(args).toContain("HEAD~30..HEAD");
  });

  it("should use custom range", () => {
    mockedExecFileSync.mockReturnValue("");
    getGitStats("v1.0", "v2.0");

    const args = mockedExecFileSync.mock.calls[0][1] as string[];
    expect(args).toContain("v1.0..v2.0");
  });

  it("should filter by author", () => {
    mockedExecFileSync.mockReturnValue("");
    getGitStats(undefined, undefined, "John");

    // Author filter is now passed as array element (safe from injection)
    const args = mockedExecFileSync.mock.calls[0][1] as string[];
    expect(args).toContain("--author=John");
  });

  it("should return error on failure", () => {
    mockedExecFileSync.mockImplementation(() => {
      throw new Error("Git error");
    });

    const result = getGitStats();

    expect(result.error).toBe("Git stats failed");
    expect(result.commits).toBe(0);
  });
});

describe("getGitHotspots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return hotspots", () => {
    // Now uses execFileSync and processes in JavaScript instead of shell pipeline
    mockedExecFileSync.mockReturnValue(
      "src/core.ts\n" +
      "src/core.ts\n" +
      "src/core.ts\n" +
      "src/utils.ts\n" +
      "src/utils.ts\n" +
      "README.md\n"
    );

    const result = getGitHotspots(10);

    expect(result).toHaveLength(3);
    // 3 changes = low, 2 changes = low, 1 change = low
    expect(result[0]).toEqual({ file: "src/core.ts", changes: 3, risk: "low" });
    expect(result[1]).toEqual({ file: "src/utils.ts", changes: 2, risk: "low" });
    expect(result[2]).toEqual({ file: "README.md", changes: 1, risk: "low" });
  });

  it("should respect limit parameter", () => {
    // Generate many file entries
    mockedExecFileSync.mockReturnValue(
      "file1.ts\nfile1.ts\nfile1.ts\n" +
      "file2.ts\nfile2.ts\n" +
      "file3.ts\n"
    );

    const result = getGitHotspots(2);

    // Only top 2 results
    expect(result).toHaveLength(2);
    expect(result[0].file).toBe("file1.ts");
    expect(result[1].file).toBe("file2.ts");
  });

  it("should return empty on error", () => {
    mockedExecFileSync.mockImplementation(() => {
      throw new Error("Git error");
    });

    const result = getGitHotspots();

    expect(result).toEqual([]);
  });

  it("should handle empty output", () => {
    mockedExecFileSync.mockReturnValue("");
    const result = getGitHotspots();
    expect(result).toEqual([]);
  });

  it("should assign risk levels correctly", () => {
    // Create enough entries to hit different risk thresholds
    const entries: string[] = [];
    for (let i = 0; i < 25; i++) entries.push("high-risk.ts");
    for (let i = 0; i < 15; i++) entries.push("medium-risk.ts");
    for (let i = 0; i < 5; i++) entries.push("low-risk.ts");

    mockedExecFileSync.mockReturnValue(entries.join("\n"));

    const result = getGitHotspots(10);

    expect(result[0]).toEqual({ file: "high-risk.ts", changes: 25, risk: "high" });
    expect(result[1]).toEqual({ file: "medium-risk.ts", changes: 15, risk: "medium" });
    expect(result[2]).toEqual({ file: "low-risk.ts", changes: 5, risk: "low" });
  });
});

describe("formatBurndownChart", () => {
  it("should format burndown data", () => {
    const burndown = [
      { date: "2025-01-01", remaining_points: 10, ideal_points: 10 },
      { date: "2025-01-02", remaining_points: 8, ideal_points: 8 },
      { date: "2025-01-03", remaining_points: 5, ideal_points: 6 },
    ];

    const result = formatBurndownChart(burndown);

    expect(result).toContain("01-01:");
    expect(result).toContain("01-02:");
    expect(result).toContain("01-03:");
    expect(result).toContain("█");
  });

  it("should return empty for no data", () => {
    const result = formatBurndownChart([]);
    expect(result).toBe("");
  });

  it("should handle zero points", () => {
    const burndown = [
      { date: "2025-01-01", remaining_points: 0, ideal_points: 0 },
    ];

    const result = formatBurndownChart(burndown);

    expect(result).toBe("No points to burn down");
  });
});

describe("Prompt Templates", () => {
  describe("getSprintPlanningPrompt", () => {
    it("should include sprint name", () => {
      const result = getSprintPlanningPrompt("Sprint 1");
      expect(result).toContain("Sprint 1");
    });

    it("should include duration", () => {
      const result = getSprintPlanningPrompt("Sprint 1", 7);
      expect(result).toContain("Duration: 7 days");
    });

    it("should use default duration", () => {
      const result = getSprintPlanningPrompt("Sprint 1");
      expect(result).toContain("Duration: 14 days");
    });

    it("should include pm_velocity_calculate reference", () => {
      const result = getSprintPlanningPrompt("Sprint 1");
      expect(result).toContain("pm_velocity_calculate");
    });
  });

  describe("getRetrospectivePrompt", () => {
    it("should include sprint ID", () => {
      const result = getRetrospectivePrompt("sprint-123");
      expect(result).toContain("sprint-123");
    });

    it("should include Start-Stop-Continue format", () => {
      const result = getRetrospectivePrompt("sprint-123");
      expect(result).toContain("Start-Stop-Continue");
    });

    it("should include pm_sprint_status reference", () => {
      const result = getRetrospectivePrompt("sprint-123");
      expect(result).toContain("pm_sprint_status");
    });
  });

  describe("getDailyStandupPrompt", () => {
    it("should include standup format", () => {
      const result = getDailyStandupPrompt();
      expect(result).toContain("What did you complete yesterday?");
      expect(result).toContain("What will you work on today?");
      expect(result).toContain("Any blockers?");
    });

    it("should include pm_task_board reference", () => {
      const result = getDailyStandupPrompt();
      expect(result).toContain("pm_task_board");
    });
  });

  describe("getRiskAssessmentPrompt", () => {
    it("should include project ID", () => {
      const result = getRiskAssessmentPrompt("project-456");
      expect(result).toContain("project-456");
    });

    it("should include pm_git_hotspots reference", () => {
      const result = getRiskAssessmentPrompt("project-456");
      expect(result).toContain("pm_git_hotspots");
    });
  });

  describe("getReleasePlanPrompt", () => {
    it("should include version", () => {
      const result = getReleasePlanPrompt("v1.0.0");
      expect(result).toContain("v1.0.0");
    });

    it("should use default version", () => {
      const result = getReleasePlanPrompt();
      expect(result).toContain("Target Version: Next");
    });

    it("should include pm_git_stats reference", () => {
      const result = getReleasePlanPrompt();
      expect(result).toContain("pm_git_stats");
    });
  });
});

describe("Schema Constants", () => {
  describe("TASK_SCHEMA", () => {
    it("should have required properties", () => {
      expect(TASK_SCHEMA.type).toBe("object");
      expect(TASK_SCHEMA.required).toContain("title");
      expect(TASK_SCHEMA.properties.id).toBeDefined();
      expect(TASK_SCHEMA.properties.status).toBeDefined();
      expect(TASK_SCHEMA.properties.priority).toBeDefined();
    });

    it("should have valid status enum", () => {
      expect(TASK_SCHEMA.properties.status.enum).toContain("todo");
      expect(TASK_SCHEMA.properties.status.enum).toContain("in_progress");
      expect(TASK_SCHEMA.properties.status.enum).toContain("done");
    });

    it("should have valid priority enum", () => {
      expect(TASK_SCHEMA.properties.priority.enum).toContain("critical");
      expect(TASK_SCHEMA.properties.priority.enum).toContain("low");
    });
  });

  describe("SPRINT_SCHEMA", () => {
    it("should have required properties", () => {
      expect(SPRINT_SCHEMA.required).toContain("name");
      expect(SPRINT_SCHEMA.required).toContain("startDate");
      expect(SPRINT_SCHEMA.required).toContain("endDate");
    });

    it("should have valid status enum", () => {
      expect(SPRINT_SCHEMA.properties.status.enum).toContain("planning");
      expect(SPRINT_SCHEMA.properties.status.enum).toContain("active");
      expect(SPRINT_SCHEMA.properties.status.enum).toContain("completed");
    });
  });

  describe("VELOCITY_METHOD_TEXT", () => {
    it("should describe velocity calculation", () => {
      expect(VELOCITY_METHOD_TEXT).toContain("Story Points");
      expect(VELOCITY_METHOD_TEXT).toContain("rolling average");
    });
  });

  describe("PM_CONVENTIONS_MD", () => {
    it("should include task naming conventions", () => {
      expect(PM_CONVENTIONS_MD).toContain("Task Naming");
      expect(PM_CONVENTIONS_MD).toContain("imperative mood");
    });

    it("should include story point definitions", () => {
      expect(PM_CONVENTIONS_MD).toContain("Story Points");
      expect(PM_CONVENTIONS_MD).toContain("1: Trivial");
      expect(PM_CONVENTIONS_MD).toContain("13: Epic");
    });

    it("should include git conventions", () => {
      expect(PM_CONVENTIONS_MD).toContain("Git Branch Naming");
      expect(PM_CONVENTIONS_MD).toContain("Conventional Commits");
      expect(PM_CONVENTIONS_MD).toContain("Magic Words");
    });
  });
});

describe("TOOL_SCHEMAS", () => {
  it("should have all project tools", () => {
    expect(TOOL_SCHEMAS.pm_project_create).toBeDefined();
    expect(TOOL_SCHEMAS.pm_project_list).toBeDefined();
  });

  it("should have all task tools", () => {
    expect(TOOL_SCHEMAS.pm_task_create).toBeDefined();
    expect(TOOL_SCHEMAS.pm_task_list).toBeDefined();
    expect(TOOL_SCHEMAS.pm_task_get).toBeDefined();
    expect(TOOL_SCHEMAS.pm_task_update).toBeDefined();
    expect(TOOL_SCHEMAS.pm_task_status).toBeDefined();
    expect(TOOL_SCHEMAS.pm_task_board).toBeDefined();
  });

  it("should have all sprint tools", () => {
    expect(TOOL_SCHEMAS.pm_sprint_create).toBeDefined();
    expect(TOOL_SCHEMAS.pm_sprint_list).toBeDefined();
    expect(TOOL_SCHEMAS.pm_sprint_status).toBeDefined();
    expect(TOOL_SCHEMAS.pm_sprint_start).toBeDefined();
    expect(TOOL_SCHEMAS.pm_sprint_complete).toBeDefined();
    expect(TOOL_SCHEMAS.pm_sprint_add_tasks).toBeDefined();
  });

  it("should have all analytics tools", () => {
    expect(TOOL_SCHEMAS.pm_velocity_calculate).toBeDefined();
    expect(TOOL_SCHEMAS.pm_burndown_data).toBeDefined();
  });

  it("should have all git tools", () => {
    expect(TOOL_SCHEMAS.pm_git_branch_create).toBeDefined();
    expect(TOOL_SCHEMAS.pm_git_commit_link).toBeDefined();
    expect(TOOL_SCHEMAS.pm_git_parse_branch).toBeDefined();
    expect(TOOL_SCHEMAS.pm_git_parse_commit).toBeDefined();
    expect(TOOL_SCHEMAS.pm_git_stats).toBeDefined();
    expect(TOOL_SCHEMAS.pm_git_hotspots).toBeDefined();
  });

  it("should have valid schema structure", () => {
    const tool = TOOL_SCHEMAS.pm_task_create;
    expect(tool.name).toBe("pm_task_create");
    expect(tool.description).toBeDefined();
    expect(tool.inputSchema.type).toBe("object");
    expect(tool.inputSchema.required).toContain("title");
    expect(tool.inputSchema.required).toContain("projectId");
  });
});
