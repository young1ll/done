/**
 * PM Plugin Git Utilities
 *
 * @deprecated LEVEL_2 Issue #4 Resolution
 * =========================================
 * All functions in this file have been consolidated into mcp/lib/server-helpers.ts.
 * This file is kept for backward compatibility only.
 *
 * Migration Guide:
 * - parseBranchName → import from "mcp/lib/server-helpers.js"
 * - parseCommitMessage → import from "mcp/lib/server-helpers.js"
 * - generateBranchName → import from "mcp/lib/server-helpers.js"
 * - getCurrentBranch → import from "mcp/lib/server-helpers.js"
 * - getGitStatus → import from "mcp/lib/server-helpers.js"
 * - getMagicWordStatusChange → import from "mcp/lib/server-helpers.js"
 * - isGitRepository → import from "mcp/lib/server-helpers.js"
 * - getGitRoot → import from "mcp/lib/server-helpers.js"
 * - getHotspots → use getGitHotspots from "mcp/lib/server-helpers.js"
 * - getCommitStats → use getGitStats from "mcp/lib/server-helpers.js"
 *
 * This file will be removed in future releases.
 */

import { execSync } from "child_process";

// ============================================
// Types
// ============================================

export interface BranchInfo {
  branch: string;
  issueNumber?: number;
  type?: string;
  description?: string;
  format: "level1" | "legacy" | "unknown";
}

export interface CommitInfo {
  type?: string;
  scope?: string;
  description: string;
  breaking: boolean;
  magicWords: MagicWord[];
  issueRefs: number[];
}

export interface MagicWord {
  action: "fixes" | "closes" | "refs" | "blocks" | "depends" | "wip" | "review" | "done";
  issueIds: number[];
}

export interface GitStatus {
  branch: string;
  isClean: boolean;
  staged: string[];
  modified: string[];
  untracked: string[];
  ahead: number;
  behind: number;
}

export interface GitCommit {
  sha: string;
  shortSha: string;
  author: string;
  email: string;
  date: string;
  message: string;
  files: string[];
  linesAdded: number;
  linesDeleted: number;
}

// ============================================
// Branch Parsing
// ============================================

/**
 * Parse current branch name to extract task info
 * LEVEL_1 format: {issue_number}-{type}-{description}
 * Legacy format: PM-123-description
 */
export function parseBranchName(branch: string): BranchInfo {
  // LEVEL_1 format: 42-feat-user-authentication
  const level1Match = branch.match(/^(\d+)-(\w+)-(.+)$/);
  if (level1Match) {
    return {
      branch,
      issueNumber: parseInt(level1Match[1], 10),
      type: level1Match[2],
      description: level1Match[3],
      format: "level1",
    };
  }

  // UUID-based format: abc12345-feat-description
  const uuidMatch = branch.match(/^([a-f0-9]{8})-(\w+)-(.+)$/);
  if (uuidMatch) {
    return {
      branch,
      type: uuidMatch[2],
      description: uuidMatch[3],
      format: "level1",
    };
  }

  // Legacy format: PM-123-description or ENG-456-description
  const legacyMatch = branch.match(/^([A-Z]+-\d+)(?:-(.+))?$/);
  if (legacyMatch) {
    return {
      branch,
      description: legacyMatch[2],
      format: "legacy",
    };
  }

  return {
    branch,
    format: "unknown",
  };
}

/**
 * Generate branch name from task info
 */
export function generateBranchName(
  issueNumber: number | string,
  type: string,
  title: string
): string {
  const description = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);

  return `${issueNumber}-${type}-${description}`;
}

// ============================================
// Commit Message Parsing
// ============================================

/**
 * Parse commit message for Conventional Commits and Magic Words
 * LEVEL_1 Section 3: Commit Convention
 */
export function parseCommitMessage(message: string): CommitInfo {
  // Parse Conventional Commits format: type(scope)!: description
  const conventionalMatch = message.match(
    /^(\w+)(?:\(([^)]+)\))?(!)?:\s*(.+)/
  );

  const type = conventionalMatch?.[1];
  const scope = conventionalMatch?.[2];
  const breaking = conventionalMatch?.[3] === "!" ||
    message.toLowerCase().includes("breaking change");
  const description = conventionalMatch?.[4] || message.split("\n")[0];

  // Parse magic words (LEVEL_1 Section 3)
  const magicWords: MagicWord[] = [];
  const issueRefs: number[] = [];

  const patterns: { action: MagicWord["action"]; pattern: RegExp }[] = [
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
      const id = parseInt(match[1], 10);
      ids.push(id);
      if (!issueRefs.includes(id)) {
        issueRefs.push(id);
      }
    }
    if (ids.length > 0) {
      magicWords.push({ action, issueIds: ids });
    }
  }

  // Also capture simple #123 references
  const simpleRefs = message.match(/#(\d+)/g) || [];
  for (const ref of simpleRefs) {
    const id = parseInt(ref.slice(1), 10);
    if (!issueRefs.includes(id)) {
      issueRefs.push(id);
    }
  }

  return {
    type,
    scope,
    description,
    breaking,
    magicWords,
    issueRefs,
  };
}

/**
 * Get the status change implied by magic words
 */
export function getMagicWordStatusChange(
  magicWords: MagicWord[]
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
// Git Commands
// ============================================

/**
 * Get current branch name
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
 * Get git status
 */
export function getGitStatus(): GitStatus | null {
  try {
    const branch = getCurrentBranch();
    if (!branch) return null;

    const status = execSync("git status --porcelain", {
      encoding: "utf-8",
    }).trim();

    const lines = status.split("\n").filter(Boolean);
    const staged: string[] = [];
    const modified: string[] = [];
    const untracked: string[] = [];

    for (const line of lines) {
      const x = line[0]; // Index status
      const y = line[1]; // Working tree status
      const file = line.slice(3);

      if (x !== " " && x !== "?") staged.push(file);
      if (y !== " " && y !== "?") modified.push(file);
      if (x === "?" && y === "?") untracked.push(file);
    }

    // Get ahead/behind
    let ahead = 0;
    let behind = 0;
    try {
      const aheadBehind = execSync(
        "git rev-list --left-right --count @{u}...HEAD 2>/dev/null",
        { encoding: "utf-8" }
      ).trim();
      const [b, a] = aheadBehind.split(/\s+/).map(Number);
      behind = b || 0;
      ahead = a || 0;
    } catch {
      // No upstream
    }

    return {
      branch,
      isClean: lines.length === 0,
      staged,
      modified,
      untracked,
      ahead,
      behind,
    };
  } catch {
    return null;
  }
}

/**
 * Get recent commits
 */
export function getRecentCommits(count = 10): GitCommit[] {
  try {
    const log = execSync(
      `git log -${count} --format="%H|%an|%ae|%aI|%s" --numstat`,
      { encoding: "utf-8" }
    );

    const commits: GitCommit[] = [];
    const lines = log.split("\n");
    let currentCommit: Partial<GitCommit> | null = null;
    let files: string[] = [];
    let added = 0;
    let deleted = 0;

    for (const line of lines) {
      if (line.includes("|")) {
        // Save previous commit
        if (currentCommit) {
          commits.push({
            ...currentCommit,
            files,
            linesAdded: added,
            linesDeleted: deleted,
          } as GitCommit);
        }

        const [sha, author, email, date, message] = line.split("|");
        currentCommit = {
          sha,
          shortSha: sha.slice(0, 7),
          author,
          email,
          date,
          message,
        };
        files = [];
        added = 0;
        deleted = 0;
      } else if (line.match(/^\d+\t\d+\t/)) {
        const [a, d, file] = line.split("\t");
        added += parseInt(a, 10) || 0;
        deleted += parseInt(d, 10) || 0;
        files.push(file);
      }
    }

    // Don't forget last commit
    if (currentCommit) {
      commits.push({
        ...currentCommit,
        files,
        linesAdded: added,
        linesDeleted: deleted,
      } as GitCommit);
    }

    return commits;
  } catch {
    return [];
  }
}

/**
 * Get commit info by SHA
 */
export function getCommitInfo(sha: string): GitCommit | null {
  try {
    const info = execSync(
      `git show ${sha} --format="%H|%an|%ae|%aI|%s" --numstat`,
      { encoding: "utf-8" }
    );

    const lines = info.split("\n");
    const [commitLine, ...statLines] = lines;
    const [fullSha, author, email, date, message] = commitLine.split("|");

    const files: string[] = [];
    let added = 0;
    let deleted = 0;

    for (const line of statLines) {
      if (line.match(/^\d+\t\d+\t/)) {
        const [a, d, file] = line.split("\t");
        added += parseInt(a, 10) || 0;
        deleted += parseInt(d, 10) || 0;
        files.push(file);
      }
    }

    return {
      sha: fullSha,
      shortSha: fullSha.slice(0, 7),
      author,
      email,
      date,
      message,
      files,
      linesAdded: added,
      linesDeleted: deleted,
    };
  } catch {
    return null;
  }
}

/**
 * Get unpushed commits
 */
export function getUnpushedCommits(): GitCommit[] {
  try {
    const commits = execSync(
      "git log @{u}..HEAD --format=\"%H|%an|%ae|%aI|%s\" 2>/dev/null",
      { encoding: "utf-8" }
    ).trim();

    if (!commits) return [];

    return commits.split("\n").map(line => {
      const [sha, author, email, date, message] = line.split("|");
      return {
        sha,
        shortSha: sha.slice(0, 7),
        author,
        email,
        date,
        message,
        files: [],
        linesAdded: 0,
        linesDeleted: 0,
      };
    });
  } catch {
    return [];
  }
}

/**
 * Check if we're in a git repository
 */
export function isGitRepository(): boolean {
  try {
    execSync("git rev-parse --git-dir", {
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
    return execSync("git rev-parse --show-toplevel", {
      encoding: "utf-8",
    }).trim();
  } catch {
    return null;
  }
}

// ============================================
// Git Analysis
// ============================================

/**
 * Get file change frequency (hotspots)
 */
export function getHotspots(
  limit = 10,
  since?: string
): { file: string; changes: number; risk: "high" | "medium" | "low" }[] {
  try {
    const sinceArg = since ? `--since="${since}"` : "";
    const result = execSync(
      `git log ${sinceArg} --pretty=format: --name-only | sort | uniq -c | sort -rn | head -${limit}`,
      { encoding: "utf-8" }
    );

    return result
      .split("\n")
      .filter(Boolean)
      .map(line => {
        const match = line.trim().match(/^(\d+)\s+(.+)$/);
        if (match) {
          const changes = parseInt(match[1], 10);
          return {
            file: match[2],
            changes,
            risk: changes > 20 ? "high" : changes > 10 ? "medium" : "low" as const,
          };
        }
        return null;
      })
      .filter(Boolean) as { file: string; changes: number; risk: "high" | "medium" | "low" }[];
  } catch {
    return [];
  }
}

/**
 * Get commit statistics
 */
export function getCommitStats(
  from?: string,
  to?: string
): { commits: number; authors: string[]; linesAdded: number; linesDeleted: number } {
  try {
    const range = from && to ? `${from}..${to}` : from ? `${from}..HEAD` : "HEAD~30..HEAD";

    const shortlog = execSync(
      `git shortlog -sn ${range}`,
      { encoding: "utf-8" }
    ).trim();

    const authors = shortlog
      .split("\n")
      .filter(Boolean)
      .map(line => line.replace(/^\s*\d+\s+/, ""));

    const stats = execSync(
      `git diff --shortstat ${range}`,
      { encoding: "utf-8" }
    ).trim();

    const commitCount = execSync(
      `git rev-list --count ${range}`,
      { encoding: "utf-8" }
    ).trim();

    const addMatch = stats.match(/(\d+) insertion/);
    const delMatch = stats.match(/(\d+) deletion/);

    return {
      commits: parseInt(commitCount, 10) || 0,
      authors,
      linesAdded: addMatch ? parseInt(addMatch[1], 10) : 0,
      linesDeleted: delMatch ? parseInt(delMatch[1], 10) : 0,
    };
  } catch {
    return { commits: 0, authors: [], linesAdded: 0, linesDeleted: 0 };
  }
}
