# Claude Plugins by young1ll

Claude Code 플러그인 컬렉션.

## Plugins

| Plugin | Description | Features |
|--------|-------------|----------|
| [pm](./plugins/pm) | AI 기반 프로젝트 관리 | MCP 통합, 이벤트 소싱, Git-First 워크플로우 |

## PM Plugin

LEVEL_1 Git-First 아키텍처 기반 프로젝트 관리 플러그인.

### 핵심 기능

- **MCP 통합**: 7 Resources, 21 Tools, 5 Prompts
- **하이브리드 에이전트**: Plan-and-Execute + ReAct + Reflexion (4개 에이전트)
- **이벤트 소싱**: 완전한 감사 추적 및 시점별 상태 재구성
- **Git 통합**: GitHub Flow 기반 브랜치 관리, Magic Words
- **토큰 효율화**: 계층적 요약 (L0-L3), 70% 압축 규칙

### 빠른 시작

```bash
# Claude Code에서
/plugins add pm@done

# 프로젝트 초기화
/pm:init

# 태스크 생성
/pm:task create "기능 구현"

# 상태 확인
/pm:status
```

### 명령어

| 명령어 | 설명 |
|--------|------|
| `/pm:init` | 프로젝트 초기화 |
| `/pm:task <action>` | 태스크 CRUD |
| `/pm:sprint <action>` | 스프린트 관리 |
| `/pm:status` | 대시보드 |

### 에이전트

| 에이전트 | 패턴 | 역할 |
|----------|------|------|
| `pm-planner` | Plan-and-Execute | 전략적 계획 |
| `pm-executor` | ReAct | 적응적 실행 |
| `pm-reflector` | Reflexion | 자기 개선 |
| `ticket-worker` | - | 이슈 구현 |

자세한 내용은 [PM Plugin README](./plugins/pm/README.md) 참조.

## 프로젝트 구조

```
young1ll-plugins/
├── plugins/
│   └── pm/                  # PM Plugin
│       ├── mcp/             # MCP 서버
│       ├── agents/          # 에이전트 (4개)
│       ├── commands/        # 슬래시 명령어 (4개)
│       ├── skills/          # 스킬 + 템플릿
│       ├── hooks/           # 이벤트 훅 (7개)
│       ├── lib/             # 유틸리티
│       ├── storage/         # SQLite + 이벤트 소싱
│       └── tests/           # 테스트 (~569개)
├── .claude-plugin/          # 루트 플러그인 설정
└── README.md
```

## 설치

```bash
# Claude Code에서
/plugins add pm@done
```

## License

MIT
