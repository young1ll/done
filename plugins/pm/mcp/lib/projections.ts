/**
 * PM Plugin Projection Repositories (Simplified)
 *
 * CQRS Read Models for tasks and projects.
 * Focus: Local Task → GitHub Issue → GitHub Project workflow
 */

import { DatabaseManager } from "./db.js";
import { EventStore, taskReducer, createProjectEvent } from "../../storage/lib/events.js";
import { randomUUID } from "crypto";

// ============================================
// Interfaces
// ============================================

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: string;
  settings?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  seq?: number;                    // Project-scoped numeric ID (e.g., #42)
  project_id: string;
  parent_id?: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  type: string;
  estimate_points?: number;
  estimate_hours?: number;
  actual_hours?: number;
  assignee?: string;
  labels?: string;
  due_date?: string;
  blocked_by?: string;
  branch_name?: string;
  linked_commits?: string;
  linked_prs?: string;
  github_issue_number?: number;
  github_issue_url?: string;
  github_project_item_id?: string;
  created_at: string;
  updated_at: string;
  started_at?: string;
  completed_at?: string;
}

export interface TaskFilter {
  projectId?: string;
  status?: string;
  assignee?: string;
  type?: string;
  priority?: string;
  limit?: number;
  offset?: number;
}

export interface ProjectConfig {
  id: number;
  project_id: string;
  github_enabled: boolean;
  github_repo?: string;
  github_project_id?: string;
  github_project_number?: number;
  field_mappings?: string;
  status_options?: string;
  sync_mode: string;
  last_sync_at?: string;
  created_at: string;
  updated_at: string;
}

// ============================================
// Project Repository
// ============================================

export class ProjectRepository {
  constructor(private db: DatabaseManager, private eventStore: EventStore) {}

  create(name: string, description?: string, settings?: Record<string, unknown>): Project {
    const id = randomUUID();
    createProjectEvent(this.eventStore, "ProjectCreated", id, {
      name,
      description,
      settings,
    });
    return this.syncFromEvents(id)!;
  }

  syncFromEvents(projectId: string): Project | undefined {
    const events = this.eventStore.getEvents("project", projectId);
    if (events.length === 0) return undefined;

    const state = events.reduce(
      (acc, event) => {
        return {
          ...acc,
          ...event.payload,
          id: projectId,
        };
      },
      {} as Record<string, unknown>
    );

    // Upsert to database
    this.db.execute(
      `INSERT INTO projects (id, name, description, status, settings)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         description = excluded.description,
         status = excluded.status,
         settings = excluded.settings`,
      [
        projectId,
        state.name,
        state.description || null,
        state.status || "active",
        state.settings ? JSON.stringify(state.settings) : null,
      ]
    );

    return this.getById(projectId);
  }

  getById(id: string): Project | undefined {
    return this.db.queryOne<Project>("SELECT * FROM projects WHERE id = ?", [id]);
  }

  getByName(name: string): Project | undefined {
    return this.db.queryOne<Project>("SELECT * FROM projects WHERE name = ?", [name]);
  }

  list(): Project[] {
    return this.db.query<Project>("SELECT * FROM projects ORDER BY created_at DESC", []);
  }

  update(id: string, updates: Partial<Project>): Project | undefined {
    const project = this.getById(id);
    if (!project) return undefined;

    const fields: string[] = [];
    const values: unknown[] = [];

    if (updates.name !== undefined) {
      fields.push("name = ?");
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      fields.push("description = ?");
      values.push(updates.description);
    }
    if (updates.status !== undefined) {
      fields.push("status = ?");
      values.push(updates.status);
    }
    if (updates.settings !== undefined) {
      fields.push("settings = ?");
      values.push(JSON.stringify(updates.settings));
    }

    if (fields.length === 0) return project;

    values.push(id);
    this.db.execute(`UPDATE projects SET ${fields.join(", ")} WHERE id = ?`, values);

    return this.getById(id);
  }
}

// ============================================
// Task Repository
// ============================================

export class TaskRepository {
  constructor(private db: DatabaseManager, private eventStore: EventStore) {}

  syncFromEvents(taskId: string): Task | undefined {
    const events = this.eventStore.getEvents("task", taskId);
    if (events.length === 0) return undefined;

    const state = events.reduce(
      taskReducer,
      null
    ) as Task & { project_id: string };

    // Get next seq for project if not set
    if (!state.seq) {
      const maxSeq = this.db.queryOne<{ max_seq: number | null }>(
        "SELECT MAX(seq) as max_seq FROM tasks WHERE project_id = ?",
        [state.project_id]
      );
      state.seq = (maxSeq?.max_seq || 0) + 1;
    }

    // Upsert to database
    this.db.execute(
      `INSERT INTO tasks (
        id, seq, project_id, parent_id, title, description,
        status, priority, type, estimate_points, estimate_hours, actual_hours,
        assignee, labels, due_date, blocked_by,
        branch_name, linked_commits, linked_prs,
        github_issue_number, github_issue_url, github_project_item_id,
        started_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        seq = excluded.seq,
        project_id = excluded.project_id,
        parent_id = excluded.parent_id,
        title = excluded.title,
        description = excluded.description,
        status = excluded.status,
        priority = excluded.priority,
        type = excluded.type,
        estimate_points = excluded.estimate_points,
        estimate_hours = excluded.estimate_hours,
        actual_hours = excluded.actual_hours,
        assignee = excluded.assignee,
        labels = excluded.labels,
        due_date = excluded.due_date,
        blocked_by = excluded.blocked_by,
        branch_name = excluded.branch_name,
        linked_commits = excluded.linked_commits,
        linked_prs = excluded.linked_prs,
        github_issue_number = excluded.github_issue_number,
        github_issue_url = excluded.github_issue_url,
        github_project_item_id = excluded.github_project_item_id,
        started_at = excluded.started_at,
        completed_at = excluded.completed_at`,
      [
        taskId,
        state.seq,
        state.project_id,
        state.parent_id || null,
        state.title,
        state.description || null,
        state.status,
        state.priority,
        state.type,
        state.estimate_points || null,
        state.estimate_hours || null,
        state.actual_hours || null,
        state.assignee || null,
        state.labels || null,
        state.due_date || null,
        state.blocked_by || null,
        state.branch_name || null,
        state.linked_commits || null,
        state.linked_prs || null,
        state.github_issue_number || null,
        state.github_issue_url || null,
        state.github_project_item_id || null,
        state.started_at || null,
        state.completed_at || null,
      ]
    );

    return this.getById(taskId);
  }

  getById(id: string): Task | undefined {
    return this.db.queryOne<Task>("SELECT * FROM tasks WHERE id = ?", [id]);
  }

  getBySeq(projectId: string, seq: number): Task | undefined {
    return this.db.queryOne<Task>(
      "SELECT * FROM tasks WHERE project_id = ? AND seq = ?",
      [projectId, seq]
    );
  }

  list(filter: TaskFilter = {}): Task[] {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filter.projectId) {
      conditions.push("project_id = ?");
      params.push(filter.projectId);
    }
    if (filter.status) {
      conditions.push("status = ?");
      params.push(filter.status);
    }
    if (filter.assignee) {
      conditions.push("assignee = ?");
      params.push(filter.assignee);
    }
    if (filter.type) {
      conditions.push("type = ?");
      params.push(filter.type);
    }
    if (filter.priority) {
      conditions.push("priority = ?");
      params.push(filter.priority);
    }

    let query = "SELECT * FROM tasks";
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(" AND ")}`;
    }
    query += " ORDER BY created_at DESC";

    if (filter.limit) {
      query += ` LIMIT ${filter.limit}`;
      if (filter.offset) {
        query += ` OFFSET ${filter.offset}`;
      }
    }

    return this.db.query<Task>(query, params);
  }

  update(id: string, updates: Partial<Task>): Task | undefined {
    const task = this.getById(id);
    if (!task) return undefined;

    const fields: string[] = [];
    const values: unknown[] = [];

    // Only allow specific fields to be updated directly
    const allowedFields = [
      "title",
      "description",
      "status",
      "priority",
      "type",
      "estimate_points",
      "estimate_hours",
      "actual_hours",
      "assignee",
      "labels",
      "due_date",
      "blocked_by",
      "branch_name",
      "linked_commits",
      "linked_prs",
      "github_issue_number",
      "github_issue_url",
      "github_project_item_id",
      "started_at",
      "completed_at",
    ];

    for (const key of allowedFields) {
      if (updates[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(updates[key]);
      }
    }

    if (fields.length === 0) return task;

    values.push(id);
    this.db.execute(`UPDATE tasks SET ${fields.join(", ")} WHERE id = ?`, values);

    return this.getById(id);
  }

  delete(id: string): boolean {
    const result = this.db.execute("DELETE FROM tasks WHERE id = ?", [id]);
    return result.changes > 0;
  }
}

// ============================================
// Project Config Repository
// ============================================

export class ProjectConfigRepository {
  constructor(private db: DatabaseManager) {}

  create(projectId: string, config: Partial<ProjectConfig>): ProjectConfig {
    this.db.execute(
      `INSERT INTO project_config (
        project_id, github_enabled, github_repo, github_project_id,
        github_project_number, field_mappings, status_options, sync_mode
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        projectId,
        config.github_enabled ? 1 : 0,
        config.github_repo || null,
        config.github_project_id || null,
        config.github_project_number || null,
        config.field_mappings || null,
        config.status_options || null,
        config.sync_mode || "manual",
      ]
    );

    return this.getByProjectId(projectId)!;
  }

  getByProjectId(projectId: string): ProjectConfig | undefined {
    return this.db.queryOne<ProjectConfig>(
      "SELECT * FROM project_config WHERE project_id = ?",
      [projectId]
    );
  }

  update(projectId: string, updates: Partial<ProjectConfig>): ProjectConfig | undefined {
    const config = this.getByProjectId(projectId);
    if (!config) return undefined;

    const fields: string[] = [];
    const values: unknown[] = [];

    if (updates.github_enabled !== undefined) {
      fields.push("github_enabled = ?");
      values.push(updates.github_enabled ? 1 : 0);
    }
    if (updates.github_repo !== undefined) {
      fields.push("github_repo = ?");
      values.push(updates.github_repo);
    }
    if (updates.github_project_id !== undefined) {
      fields.push("github_project_id = ?");
      values.push(updates.github_project_id);
    }
    if (updates.github_project_number !== undefined) {
      fields.push("github_project_number = ?");
      values.push(updates.github_project_number);
    }
    if (updates.field_mappings !== undefined) {
      fields.push("field_mappings = ?");
      values.push(updates.field_mappings);
    }
    if (updates.status_options !== undefined) {
      fields.push("status_options = ?");
      values.push(updates.status_options);
    }
    if (updates.sync_mode !== undefined) {
      fields.push("sync_mode = ?");
      values.push(updates.sync_mode);
    }
    if (updates.last_sync_at !== undefined) {
      fields.push("last_sync_at = ?");
      values.push(updates.last_sync_at);
    }

    if (fields.length === 0) return config;

    values.push(projectId);
    this.db.execute(
      `UPDATE project_config SET ${fields.join(", ")} WHERE project_id = ?`,
      values
    );

    return this.getByProjectId(projectId);
  }
}
