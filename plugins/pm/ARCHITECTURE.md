# PM Plugin Architecture

LEVEL_1 Git-First 아키텍처 기반 프로젝트 관리 플러그인.

## 설계 원칙

1. **Git-First**: GitHub Flow 기반 워크플로우
2. **MCP 통합**: Resources/Tools/Prompts 패턴
3. **이벤트 소싱**: 완전한 감사 추적 및 시점별 상태 재구성
4. **하이브리드 에이전트**: Plan-and-Execute + ReAct + Reflexion
5. **토큰 효율화**: 계층적 요약, 70% 압축 규칙

## 디렉토리 구조

```
plugins/pm/
├── .claude-plugin/
│   ├── plugin.json              # 플러그인 매니페스트
│   └── mcp.json                 # MCP 서버 설정
│
├── mcp/                         # MCP 서버 구현
│   ├── server.ts                # MCP 서버 엔트리포인트
│   │                            # Resources, Tools, Prompts 정의
│   └── lib/
│       ├── db.ts                # SQLite DatabaseManager
│       ├── projections.ts       # Repository Layer (CQRS 읽기 모델)
│       ├── server-handlers.ts   # 요청 핸들러
│       └── server-helpers.ts    # Git 헬퍼 함수
│
├── storage/                     # 저장소 계층
│   ├── schema.sql               # SQLite 스키마
│   ├── migrations/              # 마이그레이션
│   └── lib/
│       └── events.ts            # 이벤트 소싱 (EventStore)
│
├── agents/                      # 에이전트 정의 (4개)
│   ├── pm-planner.md            # Plan-and-Execute: 전략적 계획
│   ├── pm-executor.md           # ReAct: 적응적 실행
│   ├── pm-reflector.md          # Reflexion: 자기 개선
│   └── ticket-worker.md         # 이슈 구현 에이전트
│
├── commands/                    # 슬래시 명령어 (4개)
│   ├── init.md                  # /pm:init - 프로젝트 초기화
│   ├── task.md                  # /pm:task - 태스크 CRUD
│   ├── sprint.md                # /pm:sprint - 스프린트 관리
│   └── status.md                # /pm:status - 상태 대시보드
│
├── skills/pm/                   # PM 스킬
│   ├── SKILL.md                 # 스킬 정의
│   ├── references/
│   │   ├── init-guide.md        # 초기화 가이드
│   │   ├── schemas/
│   │   │   └── project.schema.yaml
│   │   └── templates/           # 문서 템플릿
│   │       ├── ARCHITECTURE.md.tpl
│   │       ├── MILESTONES.md.tpl
│   │       ├── PLAN.md.tpl
│   │       ├── REPORT.md.tpl
│   │       └── ...
│   └── scripts/
│       ├── pm                   # CLI 스크립트
│       └── lib/
│           ├── common.sh
│           └── yaml-parser.sh
│
├── hooks/                       # 이벤트 훅 (7개)
│   ├── hooks.json               # 훅 설정
│   └── scripts/
│       ├── post-commit.sh
│       ├── session-start.sh
│       └── session-summary.sh
│
├── lib/                         # 공통 유틸리티
│   ├── github.ts                # GitHub CLI 래퍼
│   ├── git.ts                   # Git 명령어 래퍼
│   ├── summarizer.ts            # 토큰 효율화
│   ├── status-mapper.ts         # 상태 매핑
│   ├── sync.ts                  # 동기화 유틸리티
│   └── sync-engine.ts           # 동기화 엔진
│
├── tests/                       # 테스트 (569개)
│   ├── unit/                    # 단위 테스트
│   ├── integration/             # 통합 테스트 (Mock 기반)
│   ├── helpers/                 # 테스트 헬퍼
│   └── e2e/                     # E2E 테스트 (실제 API)
│       ├── config/              # Vitest E2E 설정
│       ├── helpers/             # E2E 헬퍼
│       ├── github/              # GitHub CLI 테스트
│       ├── git/                 # Git 명령어 테스트
│       ├── mcp/                 # MCP 워크플로우 테스트
│       └── integration/         # 동기화 테스트
│
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── ARCHITECTURE.md              # 이 문서
└── README.md
```

## MCP 통합 설계

### Resources (7개, 정적)

| URI | MIME Type | 설명 |
|-----|-----------|------|
| `pm://schema/task` | application/json | 태스크 엔티티 스키마 |
| `pm://schema/sprint` | application/json | 스프린트 엔티티 스키마 |
| `pm://meta/velocity-method` | text/plain | 속도 계산 방법론 |
| `pm://docs/conventions` | text/markdown | PM 컨벤션 문서 |
| `pm://config` | application/json | 프로젝트 설정 |
| `pm://context/active` | application/json | 활성 컨텍스트 (프로젝트, 스프린트, Git 브랜치) |
| `pm://git/status` | application/json | Git 저장소 상태 |

### Tools (21개, 동적)

#### Project (2개)
```typescript
pm_project_create(name, description?)     // 프로젝트 생성
pm_project_list()                          // 프로젝트 목록
```

#### Task (6개)
```typescript
pm_task_create(title, projectId, type?, priority?, estimatePoints?, sprintId?)
pm_task_list(projectId?, sprintId?, status?, assignee?, type?, priority?, limit?, offset?)
pm_task_get(taskId)
pm_task_update(taskId, title?, description?, status?, priority?, estimatePoints?, assignee?)
pm_task_status(taskId, status, reason?)    // 상태 변경 전용
pm_task_board(projectId, sprintId?)        // 상태별 그룹화된 보드 뷰
```

#### Sprint (6개)
```typescript
pm_sprint_create(name, projectId, startDate, endDate, goal?)
pm_sprint_list(projectId)
pm_sprint_status(sprintId)                 // 진행률, 태스크 현황
pm_sprint_start(sprintId)
pm_sprint_complete(sprintId)               // 완료 + velocity 기록
pm_sprint_add_tasks(sprintId, taskIds[])
```

#### Analytics (2개)
```typescript
pm_velocity_calculate(projectId, sprintCount?)  // 롤링 평균 velocity
pm_burndown_data(sprintId)                      // ASCII 번다운 차트 포함
```

#### Git Integration (6개)
```typescript
pm_git_branch_create(taskId, type?)        // LEVEL_1 형식 브랜치 생성
pm_git_commit_link(taskId, commitSha, branch?, message?)
pm_git_parse_branch()                      // 현재 브랜치에서 태스크 ID 추출
pm_git_parse_commit(message)               // Magic words 파싱
pm_git_stats(from?, to?, author?)          // 커밋 통계
pm_git_hotspots(limit?)                    // 자주 변경된 파일 (리스크 지표)
```

### Prompts (5개, 템플릿)

| Prompt | 설명 | 인자 |
|--------|------|------|
| `sprint-planning` | 스프린트 계획 세션 | sprintName (필수), duration |
| `retrospective` | 회고 세션 + Git 분석 | sprintId (필수) |
| `daily-standup` | 데일리 스탠드업 | - |
| `risk-assessment` | 리스크 평가 + 핫스팟 | projectId (필수) |
| `release-plan` | 릴리스 계획 + 체인지로그 | version |

## 에이전트 아키텍처

### 1. PM Planner (Plan-and-Execute)

전략적 계획 수립. 스프린트 계획, 로드맵 생성, 에픽 분해.

```
목표 분석 → 다단계 계획 생성 → 각 단계를 pm-executor에 위임 → 진행 모니터링
```

- **용도**: 복잡한 프로젝트 계획, 장기 목표 분해
- **도구**: pm_task_*, pm_sprint_*, Read, Write

### 2. PM Executor (ReAct)

적응적 실행. 백로그 정리, 의존성 조사, 이해관계자 Q&A.

```
Thought → Action → Observation → 반복
```

- **용도**: 동적 작업 실행, 상황 기반 의사결정
- **도구**: pm_task_*, Bash, Read, Grep

### 3. PM Reflector (Reflexion)

자기 개선. 추정 오류 학습, 회고 결과 반영.

```
결과 평가 → 언어적 피드백 생성 → 에피소딕 메모리 저장 → 다음 추정 반영
```

- **용도**: 추정 정확도 향상, 팀 회고
- **도구**: pm_velocity_*, Read, Write

### 4. Ticket Worker

이슈 구현. 단일 태스크에 집중한 실행.

- **용도**: 개별 이슈/태스크 구현
- **도구**: Bash, Read, Write, Edit, pm_task_status

## 훅 시스템

### 이벤트 훅 (7개)

| 이벤트 | 트리거 | 동작 |
|--------|--------|------|
| PostToolUse(git checkout -b) | 브랜치 생성 시 | LEVEL_1 네이밍 검증, 태스크 상태 업데이트 |
| PreToolUse(git commit) | 커밋 전 | Conventional Commits 검증, Magic words 안내 |
| PostToolUse(git commit) | 커밋 후 | 커밋 링크, Magic words 처리 |
| PreToolUse(git push) | 푸시 전 | PR 생성 안내, 상태 업데이트 |
| PostToolUse(Write\|Edit) | MILESTONES.md 수정 시 | 진행 상황 체크, 회고 트리거 |
| Stop | 세션 종료 시 | 세션 요약 저장 |
| SessionStart | 세션 시작 시 | 컨텍스트 로드 |

## Git 통합 (LEVEL_1)

### 브랜치 명명

```
{issue_id}-{type}-{description}
```

- **Types**: feat, fix, refactor, docs, test, chore
- **예시**: `a1b2c3d4-feat-user-authentication`

### Magic Words (커밋 메시지)

| Magic Word | 효과 |
|------------|------|
| `fixes #XX` / `closes #XX` | 태스크 완료 (PR 머지 시) |
| `refs #XX` | 태스크 링크 (상태 변경 없음) |
| `wip #XX` | in_progress 상태로 변경 |
| `review #XX` | in_review 상태로 변경 |

### Conventional Commits

```
<type>(<scope>): <description> [#issue]
```

- **Types**: feat, fix, docs, style, refactor, test, chore

## 저장소 계층

### Hot Tier (메모리)

- 활성 세션 상태
- 최근 N개 도구 출력
- 즉시 태스크 컨텍스트
- **보존**: 세션 기간

### Warm Tier (SQLite)

- 대화 히스토리
- 에피소딕 트레이스
- 태스크/스프린트 스냅샷
- 이벤트 로그
- **보존**: 일~주

### Cold Tier (Vector DB) - 계획

- 히스토리컬 임베딩
- 완료된 회고
- 검색 가능 아카이브
- **보존**: 영구

## 이벤트 소싱

### 핵심 이벤트 타입

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

### CQRS 패턴

- **쓰기 모델**: EventStore (events.ts)
- **읽기 모델**: Projections (projections.ts)
  - ProjectRepository
  - SprintRepository
  - TaskRepository
  - AnalyticsRepository

## 토큰 효율화 전략

### 계층적 요약

| Level | 내용 | 트리거 |
|-------|------|--------|
| L0 (Raw) | 개별 태스크 업데이트, 코멘트, 커밋 | N/A |
| L1 (Story) | 스토리 요약, 주요 결정, 블로커 | 20 메시지마다 |
| L2 (Epic) | 에픽 진행, 리스크, 교차 의존성 | 주간 또는 마일스톤 |
| L3 (Project) | 프로젝트 헬스, 전략적 결정 | 세션 경계 |

### 70% 규칙

컨텍스트 70% 도달 전 압축. 압축 후 40-50% 작업 공간 유지.

### 컴팩트 포맷

- JSON → CSV 변환으로 40-50% 절감
- 커스텀 컴팩트 포맷으로 최대 90% 절감
- 대시보드: 전체 객체 대신 카운트/그룹 반환

```typescript
// Before
{ tasks: [{...}, {...}, ...] }  // 수천 토큰

// After
{ total: 10, byStatus: { todo: 3, in_progress: 5, done: 2 }, points: 34 }  // ~50 토큰
```

## 테스트 구조

| 유형 | 테스트 수 | 설명 |
|------|----------|------|
| Unit | ~200 | 개별 함수/클래스 테스트 |
| Integration | ~325 | Mock 기반 통합 테스트 |
| E2E | ~44 | 실제 GitHub CLI, Git, SQLite |
| **총계** | **~569** | 커버리지 81%+ |

### E2E 테스트 범위

- **GitHub CLI**: 이슈 CRUD, 코멘트, 상태 변경
- **Git 명령어**: 브랜치, 커밋 히스토리, 핫스팟 분석
- **파일 기반 SQLite**: 실제 DB 파일 생성/삭제
- **MCP 워크플로우**: 프로젝트 → 태스크 → 스프린트 → 완료
