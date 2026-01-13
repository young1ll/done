---
description: Generate automated progress reports (daily/weekly/monthly)
argument-hint: "[daily|weekly|monthly]"
allowed-tools: [Read, Write, Glob, Grep, Bash]
---

# /pm:auto-report [type]

Generate automated progress reports.

## Arguments

- `type`: Report type (default: `weekly`)
  - `daily`: Today's progress summary
  - `weekly`: Last 7 days summary
  - `monthly`: Last 30 days summary

## Prerequisites

- `PROJECT.yaml` file must exist
- `MILESTONES.md` file must exist
- `docs/analytics/` directory (will be created if missing)

## Workflow

1. Parse argument to determine report type
2. Read PROJECT.yaml for project info
3. Collect data based on report type:
   - Task completion status from MILESTONES.md
   - Git commit stats (if git repo)
   - Code changes summary
4. Generate report using template
5. Save to `docs/analytics/` directory

## Report Types

### Daily Report

**Filename**: `DAILY_YYYY-MM-DD.md`

**Contents**:
- Today's completed tasks
- In-progress tasks
- Blockers
- Today's code changes (commit count, files changed)

### Weekly Report

**Filename**: `WEEKLY_YYYY-WNN.md`

**Contents**:
- Week summary
- Burndown status
- Velocity for the week
- Completed tasks this week
- Next week's planned tasks
- Code activity summary
- Hotspots (most changed files)
- Contributors summary

### Monthly Report

**Filename**: `MONTHLY_YYYY-MM.md`

**Contents**:
- Executive summary
- Milestone progress table
- Velocity trend chart
- Major accomplishments
- Challenges and blockers
- Lessons learned
- Code activity statistics
- Next month goals and priorities

## Output Directory

Save all reports to: `docs/analytics/`

Create directory if it doesn't exist:
```bash
mkdir -p docs/analytics
```

## Git Integration

Collect git statistics for the report period:

```bash
# Commit count
git log --oneline --since="YYYY-MM-DD" | wc -l

# File changes
git diff --stat HEAD~N

# Shortlog for contributors
git shortlog -sn --since="YYYY-MM-DD"
```

## Output Format

After generating report, display:

```
📋 Report Generated
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Type:     Weekly Report
Period:   2025-01-06 ~ 2025-01-13
Saved to: docs/analytics/WEEKLY_2025-W02.md

Summary:
  Tasks Completed: 8
  Velocity:        1.14 tasks/day
  Status:          On Track
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Template References

Templates located at:
- `skills/analytics/references/templates/DAILY_REPORT.md.tpl`
- `skills/analytics/references/templates/WEEKLY_REPORT.md.tpl`
- `skills/analytics/references/templates/MONTHLY_REPORT.md.tpl`

## Error Handling

- If git not available: Skip git statistics, note in report
- If no tasks: Generate report with "No task data available"
- If report already exists: Ask user to overwrite or create timestamped version
