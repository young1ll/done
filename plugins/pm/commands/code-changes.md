---
description: Analyze git-based code changes for current milestone
allowed-tools: [Read, Glob, Grep, Bash]
---

# /pm:code-changes

Analyze git commit history and code changes for current milestone.

## Prerequisites

- Project must be a git repository
- `PROJECT.yaml` file must exist
- `MILESTONES.md` file with start date

## Workflow

1. Read MILESTONES.md to find current milestone start date
2. Run git commands to collect statistics
3. Analyze and format results
4. Display summary report

## Data Collection

### Period Determination

Extract milestone start date from MILESTONES.md:

```markdown
## Current: v0.2.0
Started: 2025-01-01
```

Use this date for `--since` parameter in git commands.

### Git Commands

```bash
# Total commits
git log --oneline --since="YYYY-MM-DD" | wc -l

# Overall stats
git diff --stat $(git log --since="YYYY-MM-DD" --format="%H" | tail -1)^..HEAD

# Files changed with frequency
git log --since="YYYY-MM-DD" --name-only --pretty=format: | sort | uniq -c | sort -rn | head -10

# Directory distribution
git log --since="YYYY-MM-DD" --name-only --pretty=format: | sed 's|/[^/]*$||' | sort | uniq -c | sort -rn | head -5

# Contributors
git shortlog -sn --since="YYYY-MM-DD"

# Detailed contributor stats
git log --since="YYYY-MM-DD" --author="NAME" --pretty=tformat: --numstat | awk '{add+=$1; del+=$2} END {print add, del}'
```

## Output Format

```
🔍 Code Changes Analysis
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Period: 2025-01-01 ~ 2025-01-13 (v0.2.0)

📊 Overview
  Commits:       45
  Files Changed: 32
  Insertions:    +1,234
  Deletions:     -456
  Net Change:    +778

🔥 Hotspots (Most Changed Files)
  1. src/api/handler.ts      (12 changes)
  2. src/models/user.ts      (8 changes)
  3. tests/api.test.ts       (7 changes)
  4. src/utils/helper.ts     (5 changes)
  5. package.json            (4 changes)

📁 Directory Distribution
  src/api/     ████████████ 45%
  src/models/  ████████     30%
  tests/       ██████       20%
  docs/        ██           5%

👥 Contributors
  alice    25 commits  (+800, -200)
  bob      15 commits  (+300, -150)
  charlie   5 commits  (+134, -106)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Analysis Insights

### Hotspots Interpretation

Files with high change frequency may indicate:
- Active development area
- Unstable or frequently-changing requirements
- Potential refactoring candidates
- Bug-prone areas needing attention

### Directory Distribution

Shows where development effort is concentrated:
- Balanced distribution: Healthy cross-cutting development
- Concentrated in one area: Focused feature work
- Test directory high: Good testing practices

### Progress Bar Generation

For directory distribution visualization:
```
percentage = (dir_changes / total_changes) * 100
bar_length = percentage / 5  # 20 chars max
bar = "█" * bar_length
```

## Error Handling

- If not a git repository: Display error "Not a git repository"
- If no commits in period: Display "No commits found since {date}"
- If no start date in MILESTONES.md: Use 30 days ago as default
- If git command fails: Show partial results with warning
