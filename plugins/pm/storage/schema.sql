-- PM Plugin SQLite Schema
-- Event Sourcing + CQRS Pattern
--
-- ============================================
-- TABLE STATUS OVERVIEW
-- ============================================
--
-- ACTIVE (used by MCP server):
--   - events          : Event store (append-only)
--   - projects        : Project entities
--   - sprints         : Sprint entities
--   - tasks           : Task entities (with seq for numeric ID)
--   - velocity_history: Sprint velocity tracking
--
-- RESERVED (for future features - Phase 3+):
--   - task_dependencies  : Task dependency tracking
--   - git_events         : Git event tracking
--   - sync_queue         : Offline-first sync queue
--   - project_config     : GitHub integration settings
--   - code_analysis_cache: Code hotspot caching
--   - releases           : Release management
--   - estimation_accuracy: Reflexion learning
--   - episodic_memory    : Reflexion memory
--   - session_summaries  : Token efficiency
--   - commits            : Git commit tracking
--   - pull_requests      : PR tracking
--
-- ============================================

-- ============================================
-- Core Tables (Event Store)
-- ============================================

-- Events table (append-only, immutable)
CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT UNIQUE NOT NULL,           -- UUID
    event_type TEXT NOT NULL,                -- TaskCreated, TaskStatusChanged, etc.
    aggregate_type TEXT NOT NULL,            -- task, sprint, project
    aggregate_id TEXT NOT NULL,              -- Entity ID
    payload TEXT NOT NULL,                   -- JSON payload
    metadata TEXT,                           -- JSON metadata (user, source, etc.)
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    version INTEGER NOT NULL DEFAULT 1       -- Optimistic concurrency
);

CREATE INDEX IF NOT EXISTS idx_events_aggregate ON events(aggregate_type, aggregate_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at);

-- ============================================
-- Read Models (Projections)
-- ============================================

-- Projects
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'active',            -- active, archived, completed
    settings TEXT,                           -- JSON: velocity_method, estimation_unit, etc.
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Sprints
CREATE TABLE IF NOT EXISTS sprints (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id),
    name TEXT NOT NULL,
    goal TEXT,
    start_date TEXT,
    end_date TEXT,
    status TEXT DEFAULT 'planning',          -- planning, active, completed, cancelled
    velocity_committed INTEGER DEFAULT 0,
    velocity_completed INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sprints_project ON sprints(project_id);
CREATE INDEX IF NOT EXISTS idx_sprints_status ON sprints(status);

-- Tasks
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    seq INTEGER,                             -- Project-scoped numeric ID (e.g., #42)
    project_id TEXT NOT NULL REFERENCES projects(id),
    sprint_id TEXT REFERENCES sprints(id),
    parent_id TEXT REFERENCES tasks(id),     -- Subtask support
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'todo',              -- todo, in_progress, in_review, done, blocked
    priority TEXT DEFAULT 'medium',          -- critical, high, medium, low
    type TEXT DEFAULT 'task',                -- epic, story, task, bug, subtask

    -- Estimation
    estimate_points INTEGER,                 -- Story points
    estimate_hours REAL,                     -- Time estimate
    actual_hours REAL,                       -- Time spent

    -- Metadata
    assignee TEXT,
    labels TEXT,                             -- JSON array
    due_date TEXT,
    blocked_by TEXT,                         -- Blocker description
    blocked_task_ids TEXT,                   -- JSON array of blocking task IDs

    -- Git Integration
    branch_name TEXT,
    linked_commits TEXT,                     -- JSON array of commit SHAs
    linked_prs TEXT,                         -- JSON array of PR numbers

    -- Timestamps
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    started_at TEXT,
    completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_sprint ON tasks(sprint_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_project_seq ON tasks(project_id, seq);

-- Task Dependencies
CREATE TABLE IF NOT EXISTS task_dependencies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL REFERENCES tasks(id),
    depends_on_id TEXT NOT NULL REFERENCES tasks(id),
    dependency_type TEXT DEFAULT 'blocks',   -- blocks, relates_to, duplicates
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(task_id, depends_on_id)
);

-- ============================================
-- Analytics Tables
-- ============================================

-- Velocity History
CREATE TABLE IF NOT EXISTS velocity_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL REFERENCES projects(id),
    sprint_id TEXT NOT NULL REFERENCES sprints(id),
    committed_points INTEGER NOT NULL,
    completed_points INTEGER NOT NULL,
    completion_rate REAL,                    -- completed / committed
    cycle_time_avg REAL,                     -- Average days per task
    recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_velocity_project ON velocity_history(project_id);

-- Estimation Accuracy (for Reflexion learning)
CREATE TABLE IF NOT EXISTS estimation_accuracy (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL REFERENCES tasks(id),
    estimated_points INTEGER,
    actual_points INTEGER,
    estimated_hours REAL,
    actual_hours REAL,
    accuracy_score REAL,                     -- 1.0 = perfect, <1 = overestimate, >1 = underestimate
    feedback TEXT,                           -- Reflexion verbal feedback
    recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================
-- Session & Context Tables
-- ============================================

-- Session Summaries (for context compression)
CREATE TABLE IF NOT EXISTS session_summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    summary_level INTEGER NOT NULL,          -- 0=raw, 1=story, 2=epic, 3=project
    content TEXT NOT NULL,                   -- Compressed summary
    token_count INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_summaries_session ON session_summaries(session_id);
CREATE INDEX IF NOT EXISTS idx_summaries_level ON session_summaries(summary_level);

-- Episodic Memory (for Reflexion)
CREATE TABLE IF NOT EXISTS episodic_memory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    memory_type TEXT NOT NULL,               -- estimation, retrospective, decision
    context TEXT NOT NULL,                   -- What was happening
    action TEXT NOT NULL,                    -- What was done
    outcome TEXT NOT NULL,                   -- What happened
    reflection TEXT NOT NULL,                -- What was learned
    relevance_embedding BLOB,                -- Vector for semantic search
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_memory_type ON episodic_memory(memory_type);

-- ============================================
-- Git Integration Tables
-- ============================================

-- Commits
CREATE TABLE IF NOT EXISTS commits (
    sha TEXT PRIMARY KEY,
    task_id TEXT REFERENCES tasks(id),
    message TEXT NOT NULL,
    author TEXT,
    branch TEXT,
    repo TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_commits_task ON commits(task_id);

-- Pull Requests
CREATE TABLE IF NOT EXISTS pull_requests (
    id INTEGER PRIMARY KEY,
    task_id TEXT REFERENCES tasks(id),
    number INTEGER NOT NULL,
    title TEXT NOT NULL,
    status TEXT DEFAULT 'open',              -- open, merged, closed
    repo TEXT,
    url TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    merged_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_prs_task ON pull_requests(task_id);

-- ============================================
-- Views for Common Queries
-- ============================================

-- Active Sprint Dashboard
CREATE VIEW IF NOT EXISTS v_active_sprint AS
SELECT
    s.id AS sprint_id,
    s.name AS sprint_name,
    s.goal,
    s.start_date,
    s.end_date,
    COUNT(t.id) AS total_tasks,
    SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) AS completed_tasks,
    SUM(CASE WHEN t.status = 'blocked' THEN 1 ELSE 0 END) AS blocked_tasks,
    SUM(COALESCE(t.estimate_points, 0)) AS total_points,
    SUM(CASE WHEN t.status = 'done' THEN COALESCE(t.estimate_points, 0) ELSE 0 END) AS completed_points,
    ROUND(100.0 * SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) / NULLIF(COUNT(t.id), 0), 1) AS progress_pct
FROM sprints s
LEFT JOIN tasks t ON t.sprint_id = s.id
WHERE s.status = 'active'
GROUP BY s.id;

-- Task Board View
CREATE VIEW IF NOT EXISTS v_task_board AS
SELECT
    t.id,
    t.title,
    t.status,
    t.priority,
    t.type,
    t.estimate_points,
    t.assignee,
    t.due_date,
    t.blocked_by,
    s.name AS sprint_name,
    p.name AS project_name
FROM tasks t
LEFT JOIN sprints s ON t.sprint_id = s.id
LEFT JOIN projects p ON t.project_id = p.id
ORDER BY
    CASE t.priority
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        WHEN 'low' THEN 4
    END,
    t.created_at DESC;

-- Velocity Trend
CREATE VIEW IF NOT EXISTS v_velocity_trend AS
SELECT
    p.name AS project_name,
    s.name AS sprint_name,
    vh.committed_points,
    vh.completed_points,
    vh.completion_rate,
    vh.cycle_time_avg,
    vh.recorded_at
FROM velocity_history vh
JOIN projects p ON vh.project_id = p.id
JOIN sprints s ON vh.sprint_id = s.id
ORDER BY vh.recorded_at DESC;

-- ============================================
-- Triggers for Auto-Update
-- ============================================

-- Update task updated_at on change
CREATE TRIGGER IF NOT EXISTS tr_tasks_updated
AFTER UPDATE ON tasks
BEGIN
    UPDATE tasks SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- Update sprint updated_at on change
CREATE TRIGGER IF NOT EXISTS tr_sprints_updated
AFTER UPDATE ON sprints
BEGIN
    UPDATE sprints SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- Update project updated_at on change
CREATE TRIGGER IF NOT EXISTS tr_projects_updated
AFTER UPDATE ON projects
BEGIN
    UPDATE projects SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- ============================================
-- LEVEL_1: Git-First Integration Tables
-- ============================================

-- Git Events (LEVEL_1 Section 11)
-- Event-driven tracking of all Git operations
CREATE TABLE IF NOT EXISTS git_events (
    id TEXT PRIMARY KEY,                         -- UUID
    event_type TEXT NOT NULL,                    -- commit, branch, merge, tag, push, pr
    ref TEXT,                                    -- Branch name or tag
    sha TEXT,                                    -- Commit SHA
    message TEXT,                                -- Commit/tag message
    author TEXT,
    author_email TEXT,
    files_changed INTEGER DEFAULT 0,
    lines_added INTEGER DEFAULT 0,
    lines_removed INTEGER DEFAULT 0,
    issue_ids TEXT,                              -- JSON array of linked issue IDs
    pr_number INTEGER,
    repo TEXT,                                   -- owner/repo
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_git_events_type ON git_events(event_type);
CREATE INDEX IF NOT EXISTS idx_git_events_sha ON git_events(sha);
CREATE INDEX IF NOT EXISTS idx_git_events_ref ON git_events(ref);
CREATE INDEX IF NOT EXISTS idx_git_events_created ON git_events(created_at);

-- Releases (LEVEL_1 Section 6)
CREATE TABLE IF NOT EXISTS releases (
    id TEXT PRIMARY KEY,                         -- UUID
    version TEXT NOT NULL,                       -- Semantic version (v1.2.3)
    tag_name TEXT NOT NULL,
    title TEXT,
    notes TEXT,                                  -- Markdown release notes
    commits TEXT,                                -- JSON array of commit SHAs
    issues_closed TEXT,                          -- JSON array of closed issue IDs
    github_release_id INTEGER,                   -- GitHub release ID
    published_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_releases_version ON releases(version);
CREATE INDEX IF NOT EXISTS idx_releases_tag ON releases(tag_name);

-- Code Analysis Cache (LEVEL_1 Section 5)
CREATE TABLE IF NOT EXISTS code_analysis_cache (
    file_path TEXT PRIMARY KEY,
    complexity_score REAL,
    change_frequency INTEGER DEFAULT 0,
    last_modified TEXT,
    primary_author TEXT,
    coupled_files TEXT,                          -- JSON array
    risk_level TEXT DEFAULT 'low',               -- high, medium, low
    analyzed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_code_analysis_risk ON code_analysis_cache(risk_level);

-- ============================================
-- LEVEL_1: Project Configuration
-- ============================================

-- Project Config (LEVEL_1 Section 8)
CREATE TABLE IF NOT EXISTS project_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL REFERENCES projects(id),
    github_enabled BOOLEAN DEFAULT 0,            -- GitHub sync ON/OFF
    github_project_id TEXT,                      -- GitHub Projects V2 ID
    github_project_number INTEGER,               -- GitHub Projects V2 number
    field_mappings TEXT,                         -- JSON: status field mappings
    status_options TEXT,                         -- JSON: allowed statuses
    sync_mode TEXT DEFAULT 'read_only',          -- read_only, bidirectional
    last_sync_at TEXT,
    last_sync_cursor TEXT,                       -- For incremental sync
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(project_id)
);

-- Sync Queue (for offline-first)
CREATE TABLE IF NOT EXISTS sync_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,                        -- create_issue, update_status, etc.
    entity_type TEXT NOT NULL,                   -- task, sprint, etc.
    entity_id TEXT NOT NULL,
    payload TEXT NOT NULL,                       -- JSON payload
    status TEXT DEFAULT 'pending',               -- pending, processing, completed, failed
    retry_count INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    processed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
CREATE INDEX IF NOT EXISTS idx_sync_queue_created ON sync_queue(created_at);

-- ============================================
-- LEVEL_1: Views for Git Integration
-- ============================================

-- Git Activity Summary
CREATE VIEW IF NOT EXISTS v_git_activity AS
SELECT
    DATE(created_at) AS date,
    COUNT(CASE WHEN event_type = 'commit' THEN 1 END) AS commits,
    COUNT(CASE WHEN event_type = 'branch' THEN 1 END) AS branches,
    COUNT(CASE WHEN event_type = 'merge' THEN 1 END) AS merges,
    COUNT(CASE WHEN event_type = 'pr' THEN 1 END) AS prs,
    SUM(lines_added) AS lines_added,
    SUM(lines_removed) AS lines_removed
FROM git_events
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Code Hotspots View
CREATE VIEW IF NOT EXISTS v_code_hotspots AS
SELECT
    file_path,
    complexity_score,
    change_frequency,
    risk_level,
    primary_author,
    analyzed_at
FROM code_analysis_cache
WHERE change_frequency > 5 OR risk_level IN ('high', 'medium')
ORDER BY
    CASE risk_level
        WHEN 'high' THEN 1
        WHEN 'medium' THEN 2
        WHEN 'low' THEN 3
    END,
    change_frequency DESC;
