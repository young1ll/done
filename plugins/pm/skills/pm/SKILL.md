---
name: pm
description: |
  AI 기반 프로젝트 관리 스킬.
  MCP 서버를 통한 태스크/스프린트 관리, 이벤트 소싱 기반 추적.
  Plan-and-Execute, ReAct, Reflexion 하이브리드 에이전트 패턴.
---

# Project Management Skill

MCP 통합 프로젝트 관리 스킬. LEVEL_1 Git-First 설계 원칙 기반.

## 아키텍처

```
Plan-and-Execute (전략적 계획) → pm-planner
        ↓
    ReAct (적응적 실행) → pm-executor
        ↓
   Reflexion (자기 개선) → pm-reflector
        ↓
    MCP Server (데이터 통합)
        ↓
    SQLite (이벤트 소싱)
```

## /pm:help 출력

**중요**: 사용자가 `/pm:help`를 실행하면 아래 형식을 **정확히 그대로** 출력하세요.

```
📋 PM — AI Project Management v2.0.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MCP 기반 프로젝트 관리. 이벤트 소싱 + 하이브리드 에이전트.

🚀 시작하기
   /pm:init              MCP 통합 프로젝트 초기화

📋 태스크
   /pm:task create       태스크 생성
   /pm:task list         태스크 목록
   /pm:task status       태스크 상태 변경

🏃 스프린트
   /pm:sprint create     스프린트 생성
   /pm:sprint status     스프린트 현황
   /pm:sprint burndown   번다운 차트
   /pm:sprint velocity   속도 분석

📊 대시보드
   /pm:status            전체 현황 대시보드

🤖 에이전트
   pm-planner            Plan-and-Execute (전략적 계획)
   pm-executor           ReAct (적응적 실행)
   pm-reflector          Reflexion (자기 개선)
   ticket-worker         이슈 구현

🔗 Git 통합
   브랜치: {seq}-{type}-{description}
   커밋: fixes #42, refs #42, wip #42

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 Quick Start
   새 프로젝트   → /pm:init
   태스크 추가  → /pm:task create "태스크명"
   상태 확인    → /pm:status
```

---

## MCP 도구

### Resources (정적)

| URI | 설명 |
|-----|------|
| `pm://schema/task` | 태스크 스키마 |
| `pm://schema/sprint` | 스프린트 스키마 |
| `pm://meta/velocity-method` | 속도 계산 방법 |
| `pm://docs/conventions` | PM 컨벤션 |
| `pm://config` | 프로젝트 설정 |
| `pm://context/active` | 활성 컨텍스트 |
| `pm://git/status` | Git 저장소 상태 |

### Tools (동적)

```typescript
// 프로젝트
pm_project_create(name, description?)
pm_project_list()

// 태스크 CRUD
pm_task_create(title, projectId, type?, priority?, estimatePoints?, sprintId?)
pm_task_list(projectId?, sprintId?, status?, assignee?, type?, priority?, limit?, offset?)
pm_task_get(taskId)
pm_task_update(taskId, title?, description?, status?, priority?, estimatePoints?, assignee?)
pm_task_status(taskId, status, reason?)
pm_task_board(projectId, sprintId?)

// 스프린트
pm_sprint_create(name, projectId, startDate, endDate, goal?)
pm_sprint_list(projectId)
pm_sprint_status(sprintId)
pm_sprint_start(sprintId)
pm_sprint_complete(sprintId)
pm_sprint_add_tasks(sprintId, taskIds)

// 분석
pm_velocity_calculate(projectId, sprintCount?)
pm_burndown_data(sprintId)

// Git 통합
pm_git_branch_create(taskId, type?)
pm_git_commit_link(taskId, commitSha, projectId?, branch?, message?)  // #seq 지원
pm_git_parse_branch()
pm_git_parse_commit(message, projectId?)  // 태스크 조회 + 상태변경 제안
pm_git_process_commit(commitSha, message, projectId, branch?, dryRun?)  // 자동 처리
pm_git_stats(from?, to?, author?)
pm_git_hotspots(limit?)

// GitHub 통합
pm_github_status()  // GitHub CLI 인증 및 저장소 상태
pm_github_config(projectId, action)  // 프로젝트별 GitHub 설정 (get/enable/disable)
pm_github_issue_create(taskId, projectId?, labels?)  // 태스크 → Issue 생성
pm_github_issue_link(taskId, issueNumber, projectId?)  // 기존 Issue 연결

// 양방향 동기화
pm_sync_pull(projectId, dryRun?)  // GitHub Issues → 로컬 태스크 동기화
pm_sync_push(taskId, projectId, action)  // 로컬 태스크 → GitHub Issues (create/update)
```

### Prompts (템플릿)

| Prompt | 설명 |
|--------|------|
| `sprint-planning` | 스프린트 계획 세션 |
| `retrospective` | 회고 세션 + Git 분석 |
| `daily-standup` | 데일리 스탠드업 |
| `risk-assessment` | 리스크 평가 + 핫스팟 |
| `release-plan` | 릴리스 계획 + 체인지로그 |

---

## 명령어

| 명령어 | 설명 |
|--------|------|
| `/pm:help` | 도움말 |
| `/pm:init` | 프로젝트 초기화 |
| `/pm:task <action>` | 태스크 CRUD |
| `/pm:sprint <action>` | 스프린트 관리 |
| `/pm:status` | 대시보드 |

---

## 에이전트 패턴

### pm-planner (Plan-and-Execute)

전략적 계획 수립. 스프린트 계획, 로드맵 생성, 에픽 분해.

```
목표 분석 → 다단계 계획 생성 → 각 단계 실행 → 진행 모니터링
```

### pm-executor (ReAct)

적응적 실행. 백로그 정리, 의존성 조사.

```
Thought → Action → Observation → 반복
```

### pm-reflector (Reflexion)

자기 개선. 추정 보정, 회고 학습.

```
결과 평가 → 언어적 피드백 → 메모리 저장 → 다음 추정 반영
```

---

## 토큰 효율화

### 계층적 요약

| Level | 내용 | 트리거 |
|-------|------|--------|
| L0 | 개별 업데이트 | N/A |
| L1 | 스토리 요약 | 20 메시지 |
| L2 | 에픽 진행 | 주간 |
| L3 | 프로젝트 헬스 | 세션 종료 |

### 70% 규칙

컨텍스트 70% 도달 전 압축. 압축 후 40-50% 작업 공간 유지.

### 컴팩트 포맷

```typescript
// 전체 객체 대신 요약 반환
{ total: 10, byStatus: {...}, points: 34 }
// → 40-50% 토큰 절감
```

---

## Git 통합 (LEVEL_1)

### 브랜치 명명

```
{seq}-{type}-{description}

예시:
  42-feat-user-authentication
  43-fix-login-bug
  44-refactor-api-client
```

### Magic Words

```
fixes #42      # 태스크 완료 (PR 머지 시)
closes #42     # 태스크 완료
refs #42       # 링크만 (상태 유지)
wip #42        # in_progress 상태로 변경
review #42     # in_review 상태로 변경
```

### 훅

- **PreToolUse(git commit)**: 태스크 링크 검증
- **PostToolUse(git commit)**: 커밋 연결
- **Stop**: 세션 요약 저장

---

## 권장 작업 시스템

모든 명령어 출력 마지막에 권장 작업 안내:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 다음 권장 작업
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  1. [필수] 블로커 해결
     → pm_task_status(PM-125, "in_progress")

  2. [권장] 번다운 확인
     → /pm:sprint burndown
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 우선순위

| 태그 | 의미 |
|------|------|
| `[필수]` | 즉시 해결 필요 |
| `[권장]` | 진행에 도움 |
| `[선택]` | 하면 좋음 |
| `[제안]` | 장기 고려 |

---

## 이벤트 타입

```typescript
type TaskEvent =
  | 'TaskCreated'
  | 'TaskStatusChanged'
  | 'TaskEstimated'
  | 'TaskLinkedToCommit'
  | 'TaskAddedToSprint'
  | 'TaskCompleted';
```

---

## Resources

- `references/templates/`: 문서 템플릿
- `references/schemas/`: PROJECT.yaml 스키마
- `references/init-guide.md`: 초기화 가이드
