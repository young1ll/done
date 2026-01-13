---
description: Analyze velocity trends across milestones
allowed-tools: [Read, Glob, Grep]
---

# /pm:velocity

Analyze task completion velocity across milestones.

## Prerequisites

- `PROJECT.yaml` file must exist
- `MILESTONES.md` file must exist with milestone history

## Workflow

1. Read PROJECT.yaml to find progress file path
2. Parse MILESTONES.md to extract all milestones
3. For each completed milestone:
   - Count total tasks
   - Calculate duration (start to completion date)
   - Calculate velocity (tasks/day)
4. Calculate average velocity and trend
5. Generate output report

## Data Extraction

Parse MILESTONES.md for multiple milestones:

```markdown
## Completed: v0.1.0 — Initial Setup
Started: 2024-12-01
Completed: 2024-12-14
Tasks: 15/15 (100%)

## Completed: v0.1.1 — Bug Fixes
Started: 2024-12-15
Completed: 2024-12-22
Tasks: 8/8 (100%)

## Current: v0.2.0 — Feature Release
Started: 2025-01-01
Target: 2025-01-15
Progress: 67%
```

## Output Format

```
📈 Velocity Analysis
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Milestone     │ Tasks │ Duration │ Velocity
──────────────┼───────┼──────────┼─────────
v0.1.0        │   15  │  14 days │  1.07/day
v0.1.1        │    8  │   7 days │  1.14/day
v0.2.0 (curr) │   8/12│  10 days │  0.80/day
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Average Velocity: 1.00 tasks/day
Trend: ↘ Decreasing (-15%)

💡 Recommendation:
   현재 속도로는 5일 추가 소요 예상
   범위 조정 또는 리소스 투입 검토
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Calculations

### Velocity per Milestone

```
velocity = completed_tasks / duration_days
```

### Average Velocity

```
avg_velocity = sum(all_velocities) / milestone_count
```

### Trend Calculation

Compare last 2-3 milestones:
- **Increasing (↗)**: Current velocity > Previous * 1.05
- **Stable (→)**: Within 5% of previous
- **Decreasing (↘)**: Current velocity < Previous * 0.95

### Projection

```
remaining_tasks = total - completed
estimated_days = remaining_tasks / current_velocity
projected_completion = today + estimated_days
```

## Recommendation Logic

Based on velocity trend and current progress:

1. **On Track + Stable/Increasing**: "진행 양호, 현재 속도 유지"
2. **Behind + Decreasing**: "범위 조정 또는 리소스 투입 검토"
3. **Ahead + Increasing**: "여유분을 다음 마일스톤 준비에 활용"

## Error Handling

- If only 1 milestone: Cannot calculate trend, show single milestone stats
- If no completed milestones: Show only current milestone data
- If missing dates: Use file modification dates as fallback
