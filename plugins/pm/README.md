# PM Plugin for Claude Code

AI 기반 프로젝트 관리 플러그인. LEVEL_1 Git-First 아키텍처.

**Plan-and-Execute**, **ReAct**, **Reflexion** 패턴을 결합한 하이브리드 에이전트 아키텍처로
MCP 서버를 통해 프로젝트 관리 데이터와 통합됩니다.

## 핵심 특징

- **Git-First**: GitHub Flow 기반 LEVEL_1 아키텍처
- **MCP 통합**: 7 Resources, 21 Tools, 5 Prompts
- **이벤트 소싱**: 완전한 감사 추적 및 시점별 상태 재구성
- **하이브리드 에이전트**: 4개 에이전트 (Plan-and-Execute + ReAct + Reflexion)
- **토큰 효율화**: 계층적 요약 (L0-L3) 및 70% 압축 규칙

## 설치

```bash
# Claude Code에서
/plugins add pm@done
```

## 빠른 시작

```bash
# 1. 프로젝트 초기화
/pm:init

# 2. 태스크 생성
/pm:task create "사용자 인증 구현"

# 3. 상태 확인
/pm:status
```

## 아키텍처

```
Plan-and-Execute (전략적 계획) → pm-planner
        ↓
    ReAct (적응적 실행) → pm-executor
        ↓
   Reflexion (자기 개선) → pm-reflector
        ↓
    MCP Server (Resources + Tools + Prompts)
        ↓
    SQLite (이벤트 소싱 + CQRS)
```

## 명령어

| 명령어 | 설명 |
|--------|------|
| `/pm:init` | 프로젝트 초기화 |
| `/pm:task <action>` | 태스크 CRUD (create, list, status) |
| `/pm:sprint <action>` | 스프린트 관리 (create, status, burndown) |
| `/pm:status` | 전체 현황 대시보드 |

## MCP 리소스

| URI | 설명 |
|-----|------|
| `pm://schema/task` | 태스크 스키마 |
| `pm://schema/sprint` | 스프린트 스키마 |
| `pm://meta/velocity-method` | 속도 계산 방법 |
| `pm://docs/conventions` | PM 컨벤션 |
| `pm://config` | 프로젝트 설정 |
| `pm://context/active` | 활성 컨텍스트 |
| `pm://git/status` | Git 상태 |

## MCP 도구

### Project
```typescript
pm_project_create(name, description?)
pm_project_list()
```

### Task
```typescript
pm_task_create(title, projectId, type?, priority?, estimatePoints?, sprintId?)
pm_task_list(projectId?, sprintId?, status?, ...)
pm_task_get(taskId)
pm_task_update(taskId, ...)
pm_task_status(taskId, status, reason?)
pm_task_board(projectId, sprintId?)
```

### Sprint
```typescript
pm_sprint_create(name, projectId, startDate, endDate, goal?)
pm_sprint_list(projectId)
pm_sprint_status(sprintId)
pm_sprint_start(sprintId)
pm_sprint_complete(sprintId)
pm_sprint_add_tasks(sprintId, taskIds[])
```

### Analytics
```typescript
pm_velocity_calculate(projectId, sprintCount?)
pm_burndown_data(sprintId)
```

### Git Integration
```typescript
pm_git_branch_create(taskId, type?)
pm_git_commit_link(taskId, commitSha, branch?, message?)
pm_git_parse_branch()
pm_git_parse_commit(message)
pm_git_stats(from?, to?, author?)
pm_git_hotspots(limit?)
```

## MCP 프롬프트

| Prompt | 설명 |
|--------|------|
| `sprint-planning` | 스프린트 계획 세션 |
| `retrospective` | 회고 세션 + Git 분석 |
| `daily-standup` | 데일리 스탠드업 |
| `risk-assessment` | 리스크 평가 + 핫스팟 |
| `release-plan` | 릴리스 계획 + 체인지로그 |

## 에이전트

| 에이전트 | 패턴 | 역할 |
|----------|------|------|
| `pm-planner` | Plan-and-Execute | 전략적 계획, 스프린트 계획, 에픽 분해 |
| `pm-executor` | ReAct | 적응적 실행, 백로그 정리, 의존성 조사 |
| `pm-reflector` | Reflexion | 자기 개선, 추정 보정, 회고 학습 |
| `ticket-worker` | - | 개별 이슈 구현 |

## Git 통합 (LEVEL_1)

### 브랜치 명명
```
{issue_id}-{type}-{description}
# 예: a1b2c3d4-feat-user-authentication
```

### Magic Words
```
fixes #XX    # 태스크 완료 (PR 머지 시)
closes #XX   # 태스크 완료
refs #XX     # 태스크 링크 (상태 변경 없음)
wip #XX      # in_progress 상태로 변경
review #XX   # in_review 상태로 변경
```

### 훅
| 이벤트 | 동작 |
|--------|------|
| 브랜치 생성 | LEVEL_1 네이밍 검증, 태스크 상태 업데이트 |
| 커밋 전 | Conventional Commits 검증 |
| 커밋 후 | 커밋 링크, Magic words 처리 |
| 푸시 전 | PR 생성 안내 |
| 세션 종료 | 세션 요약 저장 |

## 토큰 효율화

### 계층적 요약
| Level | 내용 | 트리거 |
|-------|------|--------|
| L0 (Raw) | 개별 업데이트 | N/A |
| L1 (Story) | 스토리 요약 | 20 메시지마다 |
| L2 (Epic) | 에픽 진행 | 주간/마일스톤 |
| L3 (Project) | 프로젝트 헬스 | 세션 경계 |

### 70% 규칙
컨텍스트 70% 도달 전 압축. 압축 후 40-50% 작업 공간 유지.

## 저장소 계층

| Tier | 저장소 | 내용 | 보존 |
|------|--------|------|------|
| Hot | 메모리 | 활성 세션, 최근 출력 | 세션 |
| Warm | SQLite | 히스토리, 이벤트, 스냅샷 | 일~주 |
| Cold | Vector DB | 임베딩, 아카이브 | 영구 (계획) |

## 이벤트 타입

```typescript
type TaskEventType =
  | 'TaskCreated'
  | 'TaskUpdated'
  | 'TaskStatusChanged'
  | 'TaskEstimated'
  | 'TaskLinkedToCommit'
  | 'TaskAddedToSprint'
  | 'TaskCompleted';
```

## 테스트

### 테스트 구조

| 유형 | 테스트 수 | 설명 |
|------|----------|------|
| Unit | ~200 | 개별 함수/클래스 |
| Integration | ~325 | Mock 기반 통합 |
| E2E | ~44 | 실제 GitHub CLI, Git, SQLite |
| **총계** | **~569** | 커버리지 81%+ |

### 실행 방법

```bash
# 단위/통합 테스트
npm test

# E2E 테스트 (실제 API 사용)
npm run test:e2e

# 커버리지 리포트
npm run test:coverage

# E2E 테스트 리소스 정리
npm run test:e2e:cleanup
```

### E2E 요구사항

```bash
# GitHub CLI 인증
gh auth login
gh auth status
```

> **참고**: API 키 불필요. `gh` CLI 인증만으로 E2E 테스트 실행 가능.

## 디렉토리 구조

```
plugins/pm/
├── .claude-plugin/           # 플러그인 매니페스트
│   ├── plugin.json
│   └── mcp.json
├── mcp/                      # MCP 서버
│   ├── server.ts             # 진입점 (Resources, Tools, Prompts)
│   └── lib/
│       ├── db.ts             # SQLite 래퍼
│       ├── projections.ts    # 리포지토리 레이어
│       └── server-helpers.ts # Git 헬퍼
├── storage/
│   ├── schema.sql            # SQLite 스키마
│   └── lib/events.ts         # 이벤트 소싱
├── agents/                   # 에이전트 (4개)
├── commands/                 # 슬래시 명령어 (4개)
├── skills/pm/                # PM 스킬 + 템플릿
├── hooks/                    # 이벤트 훅 (7개)
├── lib/                      # 공통 유틸리티
│   ├── github.ts             # GitHub CLI 래퍼
│   ├── git.ts                # Git 명령어 래퍼
│   └── sync-engine.ts        # 동기화 엔진
├── tests/                    # 테스트 (~569개)
├── package.json
├── ARCHITECTURE.md           # 상세 아키텍처
└── README.md                 # 이 문서
```

## NPM 스크립트

```bash
npm run build          # TypeScript 컴파일
npm run dev            # 개발 서버 (tsx watch)
npm start              # 프로덕션 서버
npm run db:init        # SQLite DB 초기화
npm run lint           # ESLint
npm run typecheck      # 타입 체크
npm test               # 단위/통합 테스트
npm run test:e2e       # E2E 테스트
npm run test:coverage  # 커버리지
```

## 참고 자료

- [ARCHITECTURE.md](./ARCHITECTURE.md) - 상세 아키텍처

## 라이선스

MIT
