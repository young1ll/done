---
description: Auto-sync MILESTONES.md progress
allowed-tools: [Read, Edit, Grep]
---

# /pm:sync

Auto-calculate and update progress in MILESTONES.md based on task checkboxes.

## Usage

```bash
/pm:sync
```

## Operation

1. **Read MILESTONES.md**
   - Check core_docs.progress path in PROJECT.yaml
   - Parse file content

2. **Calculate progress**
   - Completed tasks: Lines starting with `- [x]` or `- [X]`
   - Incomplete tasks: Lines starting with `- [ ]`
   - Progress = (completed / total) * 100

3. **Update file**
   - Update `Progress: N%` line
   - Update `Last updated: YYYY-MM-DD` line

## Example

### Before
```markdown
## Current: v0.1.0

Progress: 25%
Last updated: 2024-01-10

### Tasks
- [x] Setup basic structure
- [x] Initialize project
- [ ] Implement core features
- [ ] Write tests
```

### After
```markdown
## Current: v0.1.0

Progress: 50%
Last updated: 2024-01-13

### Tasks
- [x] Setup basic structure
- [x] Initialize project
- [ ] Implement core features
- [ ] Write tests
```

## Output Format

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔄 PM Sync — {{ project-name }}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ MILESTONES.md 진행률 동기화 완료

  이전: 25% (2/8)
  현재: 50% (4/8)
  변화: +25% (+2 태스크 완료)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 다음 권장 작업
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  1. [권장] 현재 진행 상황 확인
     → /pm:status

  2. [선택] 번다운 차트로 일정 확인
     → /pm:burndown

  3. [선택] velocity 트렌드 분석
     → /pm:velocity
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Recommended Actions Logic

동기화 후 진행률에 따른 권장 작업:

| 진행률 | 권장 작업 |
|--------|----------|
| < 30% | 태스크 시작 독려, /pm:status |
| 30-70% | /pm:burndown으로 일정 확인 |
| > 70% | 마무리 준비, /pm:velocity |
| 100% | /pm:new-report, 다음 마일스톤 준비 |

## CLI Script

```bash
${CLAUDE_PLUGIN_ROOT}/skills/pm/scripts/pm sync
```
