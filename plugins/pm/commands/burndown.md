---
description: Generate ASCII burndown chart for current milestone
allowed-tools: [Read, Glob, Grep]
---

# /pm:burndown

Generate ASCII burndown chart showing task completion over time.

## Prerequisites

- `PROJECT.yaml` file must exist
- `MILESTONES.md` file must exist with tasks

## Workflow

1. Read PROJECT.yaml to find progress file path
2. Parse MILESTONES.md to extract:
   - Current milestone name
   - Milestone start date (from `Started:` field)
   - Target end date (from `Target:` field)
   - Total tasks count
   - Completed tasks count
3. Calculate ideal burndown line
4. Generate ASCII chart

## Data Extraction

Parse MILESTONES.md for milestone metadata:

```markdown
## Current: v0.2.0 — Feature Release
Started: 2025-01-01
Target: 2025-01-15
Progress: 67%

### Tasks
- [x] Task 1
- [x] Task 2
- [ ] Task 3
- [ ] Task 4
```

## ASCII Chart Format

```
📉 Burndown Chart: v0.2.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Tasks │
  12  │■
  10  │■■
   8  │■■■■
   6  │  ■■■■■     ← Ideal
   4  │    ■■■■■■■ ← Actual
   2  │        ■■■■■■
   0  │──────────────────→ Days
      └─────────────────────────────────────
       D1  D3  D5  D7  D9  D11 D13 D15

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Summary
  Total Tasks:  12
  Completed:    8 (67%)
  Remaining:    4
  Days Elapsed: 10 / 15
  On Track:     ⚠ Slightly behind
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Progress Status Logic

Calculate status based on actual vs ideal progress:

- **On Track**: Actual remaining <= Ideal remaining
- **Slightly Behind**: Actual remaining <= Ideal remaining * 1.1
- **Behind Schedule**: Actual remaining > Ideal remaining * 1.1
- **Ahead of Schedule**: Actual remaining < Ideal remaining * 0.9

## Chart Generation Rules

1. Y-axis: Task count (0 to total tasks)
2. X-axis: Days (D1, D3, D5, ...)
3. Use `■` for data points
4. Use `─` for axes
5. Mark Ideal and Actual lines clearly
6. Scale chart width to fit terminal (max 50 chars)

## Error Handling

- If no start/target date: Show warning, display current snapshot only
- If no tasks: Display "No tasks found in current milestone"
- If milestone completed: Show completion message with final chart
