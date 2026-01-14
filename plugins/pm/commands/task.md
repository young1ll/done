---
description: Task management with Git-First workflow
argument-hint: <action> [options]
allowed-tools: [pm_task_create, pm_task_list, pm_task_get, pm_task_update, pm_task_status, pm_task_board, pm_git_branch_create, Bash]
---

# /pm:task

Git-First 워크플로우 기반 태스크 관리.

## ID 체계

태스크는 **하이브리드 ID 체계**를 사용합니다:

- **UUID**: 내부적으로 사용되는 고유 식별자
- **seq**: 프로젝트별 순차 번호 (`#1`, `#2`, `#42`)

사용자 친화적인 `#seq` 형식으로 태스크를 참조하면서, 내부적으로는 UUID로 관리됩니다.

## Usage

```bash
# 생성
/pm:task create "태스크 제목"
/pm:task create "태스크 제목" --type bug --priority high --points 3
/pm:task create "태스크 제목" --branch   # 브랜치도 함께 생성

# 조회
/pm:task list
/pm:task list --status in_progress
/pm:task list --sprint current
/pm:task get 42
/pm:task board                           # 칸반 보드 뷰

# 상태 변경
/pm:task status 42 in_progress
/pm:task status 42 done
/pm:task status 42 blocked --reason "API 키 대기"

# 업데이트
/pm:task update 42 --points 5 --assignee "user"

# 브랜치 생성 (Git-First)
/pm:task branch 42                       # 42-feat-task-title 브랜치 생성
```

## Git-First Workflow

태스크는 Git 브랜치와 1:1 매핑됩니다:

```
Task #42 "사용자 인증 구현"
        │
        ▼
Branch: 42-feat-user-authentication
        │
        ├── Commit: "feat(auth): add login endpoint"
        ├── Commit: "feat(auth): add token validation"
        └── Commit: "test(auth): add unit tests"
        │
        ▼
PR → main (fixes #42)
        │
        ▼
Task #42 → Done
```

### 브랜치 네이밍 규칙

```
{issue_number}-{type}-{description}

예시:
  42-feat-user-authentication
  43-fix-login-bug
  44-refactor-api-client
  45-docs-readme-update
```

## Actions

### create

```typescript
pm_task_create({
  title: string,           // 필수
  description?: string,
  projectId: string,       // PROJECT.yaml에서 자동
  type?: 'epic' | 'story' | 'task' | 'bug' | 'subtask',
  priority?: 'critical' | 'high' | 'medium' | 'low',
  estimatePoints?: number,
  sprintId?: string
})
```

**--branch 옵션 사용 시:**

```typescript
// 1. 태스크 생성
const task = await pm_task_create({ title, type, ... });

// 2. 브랜치 생성
await pm_git_branch_create({
  taskId: task.id,
  type: "feat",  // 태스크 타입에서 추론
  description: "sanitized-title"
});

// 3. 태스크 상태 업데이트
await pm_task_status({
  taskId: task.id,
  status: "in_progress"
});
```

### list

```typescript
pm_task_list({
  projectId?: string,
  sprintId?: string,
  status?: string,
  assignee?: string,
  type?: string,
  limit?: number,    // 기본 50
  offset?: number
})
```

### board (칸반)

```typescript
pm_task_board({
  projectId?: string,
  sprintId?: string
})
```

### status

```typescript
pm_task_status({
  taskId: string,
  status: 'todo' | 'in_progress' | 'in_review' | 'done' | 'blocked',
  reason?: string    // blocked 시 필수
})
```

**Magic Words 자동 처리:**
커밋 메시지에 magic words가 포함되면 자동으로 상태 변경:

```
git commit -m "feat: complete auth fixes #42"
→ Task #42 상태가 "done"으로 변경

git commit -m "wip #42 halfway done"
→ Task #42 상태가 "in_progress"로 변경
```

## Output Format

### 태스크 목록

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Tasks — Sprint 23
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ID  │ Title                    │ Status      │ Pts │ Branch
────┼──────────────────────────┼─────────────┼─────┼───────────────────
#42 │ API 엔드포인트 구현      │ in_progress │  5  │ 42-feat-api-impl
#43 │ 단위 테스트 작성         │ todo        │  3  │ -
#44 │ 외부 API 연동            │ blocked     │  8  │ 44-feat-external-api

Total: 3 tasks | 16 points
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 칸반 보드

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Task Board — Sprint 23
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 TODO (2)          │ IN PROGRESS (2)   │ IN REVIEW (1)     │ DONE (5)
───────────────────┼───────────────────┼───────────────────┼──────────────────
 #43 테스트 작성   │ #42 API 구현      │ #45 문서 업데이트 │ #38 로그인
   3 pts           │   5 pts           │   2 pts           │ #39 DB 스키마
                   │ #46 리팩토링      │                   │ #40 환경설정
 #47 CI 설정       │   3 pts           │                   │ #41 배포 스크립트
   2 pts           │                   │                   │ #37 초기 설정
───────────────────┼───────────────────┼───────────────────┼──────────────────
 5 pts             │ 8 pts             │ 2 pts             │ 19 pts

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 태스크 상세

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Task #42 — API 엔드포인트 구현
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Status:   in_progress
Type:     feat
Priority: high
Points:   5
Sprint:   Sprint 23

Description:
  RESTful API 엔드포인트 구현

Git:
  Branch: 42-feat-api-endpoints
  Commits: 3
    abc1234 feat(api): add user endpoint
    def5678 feat(api): add auth middleware
    ghi9012 test(api): add integration tests

Timeline:
  Created:  2024-01-10 09:00
  Started:  2024-01-12 14:30
  Elapsed:  2d 4h

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Related

- `/pm:sprint` - 스프린트 관리
- `/pm:status` - 전체 현황
