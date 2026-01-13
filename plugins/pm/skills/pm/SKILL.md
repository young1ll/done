---
name: pm
description: |
  프로젝트 문서 관리 및 작업 흐름 조율 스킬.
  PM 플러그인의 핵심 스킬로, /pm 명령어를 통해 문서 관리 기능 제공.
  /pm:init - 프로젝트 초기화
  /pm:status - 진행 상황 확인
  /pm:validate - 문서 검증
  /pm:burndown - 번다운 차트
  /pm:velocity - velocity 분석
  /pm:auto-report - 자동 보고서
  /pm:code-changes - 코드 변경 분석
---

# Project Management

프로젝트별 핵심 문서를 체계적으로 관리하고, 일관된 작업 흐름을 유지한다.

> **Note**: 이 스킬은 PM 플러그인(`~/.claude/plugins/pm/`)의 일부입니다.
> 개별 명령어는 `/pm:init`, `/pm:status` 등으로도 접근 가능합니다.

## /pm:help 출력

**중요**: 사용자가 `/pm:help` 또는 `/pm:help`를 실행하면 아래 형식을 **정확히 그대로** 출력하세요.

```
📋 PM — Project Management v1.0.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
프로젝트 문서를 체계적으로 관리하고 작업 흐름을 유지합니다.

🚀 시작하기
   /pm:init           새 프로젝트 초기화
   /pm:adopt          기존 프로젝트에 도입 (코드 분석)

📊 조회
   /pm:status         마일스톤 진행률 + 문서 상태 + 권장 작업
   /pm:validate       문서 + 시스템 무결성 검증 (11가지)

📈 분석
   /pm:burndown       번다운 차트 (ASCII)
   /pm:velocity       마일스톤별 velocity 분석
   /pm:auto-report    자동 보고서 (daily/weekly/monthly)
   /pm:code-changes   git 기반 코드 변경 분석

📝 생성
   /pm:new-plan <name>       계획 문서 생성
   /pm:new-report <topic>    보고서 생성

🔄 동기화
   /pm:sync           MILESTONES 진행률 자동 계산

📁 핵심 파일
   PROJECT.yaml       프로젝트 설정 (필수)
   MANIFESTO.md       비전/방향성
   MILESTONES.md      마일스톤/태스크

🤖 에이전트
   project-analyzer    프로젝트 구조 분석 및 문서 제안
   milestone-tracker   마일스톤 진행 추적 및 블로커 식별
   analytics-reporter  자동 보고서 생성 및 트렌드 분석
   code-analyzer       git 코드 변경 패턴 분석

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 Quick Start
   새 프로젝트   → /pm:init
   기존 프로젝트 → /pm:adopt
   진행 확인    → /pm:status
```

---

## Commands

| 명령어 | 설명 |
|--------|------|
| `/pm:help` | 사용법 안내 표시 |
| `/pm:init` | 새 프로젝트 문서 체계 초기화 |
| `/pm:adopt` | 기존 프로젝트에 문서 체계 도입 (코드 분석) |
| `/pm:status` | 마일스톤 진행률 + 문서 상태 확인 |
| `/pm:validate` | 문서 + 시스템 무결성 검증 (11가지: 구조, 품질, 테스트, 빌드, 의존성 등) |
| `/pm:new-plan <name>` | 계획 문서 생성 |
| `/pm:new-report <topic>` | 보고서 생성 |
| `/pm:sync` | MILESTONES 진행률 동기화 |
| `/pm:burndown` | ASCII 번다운 차트 생성 |
| `/pm:velocity` | 마일스톤별 velocity 분석 |
| `/pm:auto-report [type]` | 자동 보고서 생성 (daily/weekly/monthly) |
| `/pm:code-changes` | git 기반 코드 변경 분석 |

스크립트 직접 실행: `~/.claude/plugins/pm/skills/pm/scripts/pm <command>`

---

## Command Reference

### /pm:init

**새 프로젝트**용 문서 체계 초기화. 기존 코드가 없거나 처음 시작할 때 사용.

```bash
/pm:init
```

**Claude 워크플로우:**
1. 프로젝트 유형 질문 (ML/백엔드/프론트엔드/라이브러리)
2. 유형에 맞는 core_docs 제안
3. 사용자 확인 후 파일 생성

**생성되는 파일:**
- `PROJECT.yaml` - 프로젝트 설정
- `MANIFESTO.md` - 비전/방향성
- `MILESTONES.md` - 마일스톤/태스크
- `docs/plans/` - 계획 문서 디렉토리
- `docs/reports/` - 보고서 디렉토리
- 프로젝트 유형별 추가 core_docs

---

### /pm:adopt

**기존 프로젝트**에 문서 체계 도입. 이미 코드와 문서가 있을 때 사용.

```bash
/pm:adopt
```

**Claude 워크플로우:**
1. 코드베이스 스캔 (의존성, 디렉토리 구조)
2. 특성 추론 (init-guide.md 매트릭스 활용)
3. 기존 문서 발견 및 통합 제안
4. GitHub Issues 마이그레이션 제안 (선택)
5. 사용자 확인 후 PROJECT.yaml 생성

**기존 문서 통합:**
- `README.md` → `MANIFESTO.md` 초안으로 활용
- `docs/*.md` → 적절한 core_doc 역할에 연결
- GitHub Issues → `MILESTONES.md` Tasks로 변환

**예시:**
```
User: /pm:adopt
Claude: [코드베이스 분석 결과]
        - 스택: Node.js, NestJS, Prisma
        - 기존 문서: README.md, docs/api.md
        - GitHub Issues: 8개 오픈

        [제안]
        core_docs:
          vision: MANIFESTO.md (README.md 기반)
          progress: MILESTONES.md
          api_spec: docs/api.md (기존 연결)
          domain_model: docs/MODEL.md (신규 생성)

        이대로 진행할까요?
```

### /pm:status

현재 프로젝트의 진행 상황을 확인합니다.

```bash
/pm:status
```

**출력 정보:**
- 현재 마일스톤 이름
- 태스크 완료율 (진행률 바)
- 남은 태스크 목록
- core_docs 문서별 상태 및 최종 수정일

### /pm:validate

프로젝트의 **문서 무결성**과 **시스템 무결성**을 11가지 관점에서 검증합니다.

```bash
/pm:validate           # 전체 검증
/pm:validate docs      # 문서 무결성만
/pm:validate system    # 시스템 무결성만
/pm:validate quick     # 빠른 검증 (빌드/테스트 실행 생략)
```

**Part A: 문서 무결성 (6가지)**

1. **📁 구조 검증** — PROJECT.yaml 필수 필드, 디렉토리 존재
2. **📄 문서 존재 검증** — core_docs에 정의된 파일 존재 여부
3. **📝 문서 품질 검증** — 내용 충실도, 템플릿 플레이스홀더, 오래된 문서
4. **🔗 일관성 검증** — 미등록 문서, MILESTONES 진행률 동기화
5. **🧹 정리 필요 검사** — 오래된 DRAFT, 임시파일
6. **📊 진행 상태 검증** — 마일스톤 진행률, 블로커 존재 여부

**Part B: 시스템 무결성 (5가지)**

7. **🔍 코드 품질 검증** — 린터, 타입 체크, 포맷터
8. **🧪 테스트 상태 검증** — 테스트 존재 및 통과 여부
9. **🏗️ 빌드 상태 검증** — 빌드 스크립트 존재 및 성공 여부
10. **📦 의존성 검증** — outdated 패키지, 보안 취약점
11. **🔧 환경 설정 검증** — .env 일관성, 설정 파일 존재

**출력 예시:**
```
📁 1. 구조 검증
  ✓ PROJECT.yaml: name 필드 존재
  ✓ core_docs: vision 정의됨
  ✓ core_docs: progress 정의됨

📄 2. 문서 존재 검증
  ✓ vision: MANIFESTO.md
  ✓ progress: MILESTONES.md
  ✗ architecture: docs/ARCHITECTURE.md (없음)

📝 3. 문서 품질 검증
  ⚠ MANIFESTO.md: 템플릿 플레이스홀더 남아있음

🔗 4. 일관성 검증
  ✓ MILESTONES 진행률 동기화됨 (25%)

🧹 5. 중복/불필요 파일 검사
  ✓ 정리가 필요한 파일 없음

📊 6. 진행 상태 검증
  ℹ 현재 마일스톤: v0.1.0
  ℹ 태스크: 2/8 완료 (6 남음)
  ✓ 블로커 없음

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  📋 검증 결과 요약
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✓ 통과: 8
  ⚠ 경고: 1
  ✗ 오류: 1

  상태: 오류 발견 — 수정이 필요합니다
```

**검증 결과:**
- `✓ 통과`: 정상 항목
- `⚠ 경고`: 검토 권장 (진행에는 문제 없음)
- `✗ 오류`: 즉시 수정 필요

### /pm:new-plan \<name\>

새 계획 문서를 생성합니다.

```bash
/pm:new-plan user-authentication
/pm:new-plan "API 리팩터링"
```

**생성 위치:** `{plans_dir}/PLAN_{name}.md`

**템플릿 포함:**
- status (DRAFT/IN_PROGRESS/COMPLETED)
- 현재 마일스톤 자동 연결
- Goals, Approach, Tasks 섹션

### /pm:new-report \<topic\> [type]

보고서를 생성합니다.

```bash
/pm:new-report sprint-1
/pm:new-report "모델 학습 결과" experiment
```

**type 옵션:** `implementation` (기본), `experiment`, `decision`, `retrospective`

**생성 위치:** `{reports_dir}/REPORT_{date}_{topic}.md`

### /pm:sync

MILESTONES.md의 진행률을 태스크 체크박스 기반으로 자동 계산하여 업데이트합니다.

```bash
/pm:sync
```

**수행 작업:**
- 완료된 태스크 개수 계산
- Progress: N% 자동 갱신
- Last updated 날짜 갱신

## Quick Reference

### PROJECT.yaml 구조

```yaml
name: project-name
description: 프로젝트 설명

core_docs:
  vision: MANIFESTO.md        # 필수: 프로젝트 방향성
  progress: MILESTONES.md     # 필수: 마일스톤/태스크
  # 이하 프로젝트별 선택
  architecture: docs/ARCHITECTURE.md
  experiments: docs/EXPERIMENTS.md

plans_dir: docs/plans
reports_dir: docs/reports

# 검증에서 제외할 파일/규칙 (선택)
ignore:
  files:
    - "docs/archived/*"       # 아카이브 문서 무시
    - "*.bak"                 # 백업 파일 무시
  rules:
    - unregistered_docs       # 미등록 문서 경고 무시

meta:
  stack: [python, fastapi]
  concerns: [ml-experiments, api-design]
```

### ignore 필드

`/pm:validate` 검증에서 제외할 파일 및 규칙을 정의합니다.

**files** — glob 패턴으로 파일 경로 무시:
```yaml
ignore:
  files:
    - "docs/archived/*"       # docs/archived/ 하위 모든 파일
    - "docs/scratch/*.md"     # docs/scratch/ 내 .md 파일
    - "*.bak"                 # 모든 .bak 파일
    - "DRAFT_*.md"            # DRAFT_ 접두사 파일
```

**rules** — 특정 검증 규칙 무시:
| 규칙 | 효과 |
|------|------|
| `unregistered_docs` | docs/*.md 미등록 문서 경고 무시 |
| `stale_documents` | 30일 이상 미수정 문서 경고 무시 |
| `old_drafts` | 14일 이상 DRAFT 상태 PLAN 경고 무시 |
| `temp_files` | 임시/백업 파일(.bak, ~, .tmp) 경고 무시 |

**사용 예시:**
```yaml
ignore:
  files:
    - "docs/archived/*"
    - "docs/reference/*"
  rules:
    - unregistered_docs
    - stale_documents
```

### Core Document Roles

| Role | 의미 | 참조 시점 |
|------|------|----------|
| `vision` | 프로젝트 철학, 방향성 | 방향성 결정 시 |
| `progress` | 마일스톤, 태스크 | 작업 시작/완료 시 |
| `architecture` | 시스템/모델 구조 | 구조 변경 시 |
| `experiments` | 실험 설계, 결과 | ML 실험 시 |
| `domain_model` | 엔티티, 관계 | 데이터 모델 변경 시 |
| `api_spec` | API 명세 | API 추가/변경 시 |
| `theory` | 이론적 배경 | 알고리즘 구현 시 |
| `data_schema` | 데이터 구조 | 데이터 파이프라인 변경 시 |
| `metrics` | 평가 지표 | 성능 측정 시 |
| `decisions` | ADR | 기술 선택 시 |

*역할은 예시이며, 프로젝트에 맞게 자유롭게 정의*

## Auto-Reference Rules

Claude는 다음 상황에서 자동으로 문서를 참조합니다:

| Context | Auto-load Documents |
|---------|---------------------|
| 프로젝트 진입 | PROJECT.yaml, progress |
| 새 작업 시작 | progress → 관련 core_docs |
| "아키텍처" 언급 | architecture |
| "API" 관련 작업 | api_spec |
| 작업 완료 시 | progress 업데이트 제안 |

### Update Protocol

1. Task 완료 → MILESTONES.md 체크박스 갱신
2. 마일스톤 완료 → 자동 보고서 생성 제안
3. core_doc 변경 → 관련 문서 검토 알림

## Usage Scenarios

### Scenario 1: 새로운 프로젝트

빈 디렉토리 또는 코드만 있고 문서가 없는 경우.

**Claude 워크플로우:**
```
1. 사용자에게 프로젝트 유형 질문
   - "이 프로젝트는 어떤 유형인가요?" (ML/백엔드/프론트엔드/라이브러리)

2. 프로젝트 유형별 core_docs 제안
   - ML: experiments, metrics, data_schema
   - 백엔드: domain_model, api_spec, decisions
   - 프론트엔드: components, architecture
   - 라이브러리: api_spec, decisions

3. 사용자 확인 후 파일 생성
   - PROJECT.yaml
   - MANIFESTO.md (비전 정의 요청)
   - MILESTONES.md (첫 마일스톤 설정 요청)
   - 선택된 core_docs 템플릿
```

**예시 대화:**
```
User: /pm:init
Claude: 프로젝트 유형을 선택해주세요:
        1. ML/AI 프로젝트
        2. 백엔드 서비스
        3. 프론트엔드 앱
        4. 라이브러리/패키지
User: 2
Claude: 백엔드 서비스에 적합한 문서 구조를 제안합니다:
        - vision: MANIFESTO.md
        - progress: MILESTONES.md
        - domain_model: docs/MODEL.md
        - api_spec: docs/API.md
        이대로 진행할까요?
```

---

### Scenario 2: 이미 진행 중인 프로젝트

기존 코드와 문서(README.md, docs/)가 있는 경우.

**Claude 워크플로우:**
```
1. 코드베이스 스캔
   - package.json, pyproject.toml 등 의존성 파일
   - src/, models/, data/ 등 디렉토리 구조
   - 기존 문서 (README.md, docs/)

2. 특성 추론 (init-guide.md 매트릭스 활용)
   | 발견 항목 | 추론 |
   |----------|------|
   | pytorch, wandb | ML 프로젝트 → experiments, metrics |
   | fastapi, express | API 서버 → api_spec |
   | migrations/ | DB 사용 → domain_model |

3. 기존 문서 통합 제안
   - README.md → MANIFESTO.md 초안으로 활용
   - docs/architecture.md → architecture로 연결
   - GitHub Issues → MILESTONES.md Tasks로 마이그레이션 제안

4. 사용자 확인 후 PROJECT.yaml 생성
```

**예시 대화:**
```
User: /pm:init
Claude: 코드베이스를 분석했습니다.

        [분석 결과]
        - 스택: Python, FastAPI, SQLAlchemy
        - 기존 문서: README.md, docs/api.md
        - 오픈 이슈: 12개

        [제안 구조]
        - vision: MANIFESTO.md (README.md 기반 생성)
        - progress: MILESTONES.md
        - domain_model: docs/MODEL.md (신규)
        - api_spec: docs/api.md (기존 연결)

        GitHub Issues를 MILESTONES.md로 가져올까요?
```

**기존 이슈 마이그레이션:**
```markdown
# MILESTONES.md

## Current: v1.2.0

### Tasks (from GitHub Issues)
- [ ] #123 사용자 인증 버그 수정
- [ ] #124 API 응답 시간 개선
- [ ] #125 테스트 커버리지 80% 달성
```

---

### Scenario 3: 일상적인 작업 흐름

프로젝트가 이미 초기화된 후의 일반적인 사용.

**작업 시작:**
```
1. /pm:status로 현재 진행 상황 확인
2. 작업할 태스크 선택
3. 관련 core_docs 참조 (architecture, api_spec 등)
4. 필요시 /pm:new-plan <feature>로 계획 문서 생성
```

**작업 중:**
```
1. 코드 작성
2. 관련 core_docs 업데이트 (API 추가 → api_spec 갱신)
3. MILESTONES.md 태스크 체크
```

**작업 완료:**
```
1. /pm:sync로 진행률 동기화
2. 필요시 /pm:new-report <topic>으로 보고서 생성
3. 마일스톤 완료 시 → 다음 마일스톤으로 이동
```

---

## Workflows

### 작업 시작
```
PROJECT.yaml → progress 확인 → 관련 core_docs 참조 → plan 확인/생성
```

### 작업 완료
```
core_docs 업데이트 → progress 갱신 → 필요시 report 작성
```

상세 가이드: `references/init-guide.md`

## Best Practices

1. **Init 먼저**: 코드 분석 또는 대화로 문서 구조 정의
2. **역할 명확히**: core_docs key는 의미있게
3. **최소한으로**: 필요한 문서만, 과도한 문서화 지양
4. **점진적 추가**: 진행하며 필요시 문서 추가
5. **PROJECT.yaml 신뢰**: Claude는 이 파일 기준으로 동작

## Resources

- `references/init-guide.md`: Init 프로세스 상세 가이드
- `references/templates/`: 역할별 문서 템플릿
- `references/schemas/`: PROJECT.yaml 검증 스키마

---

## 권장 작업 안내 시스템 (Recommended Actions)

**핵심 원칙**: PM의 모든 명령어는 실행 결과와 함께 **다음에 해야 할 권장 작업**을 반드시 안내한다.

### 출력 형식

모든 pm 명령어 결과의 마지막에 다음 형식으로 권장 작업을 출력:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 다음 권장 작업
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  1. [우선순위] 작업 설명
     → 실행할 명령어 또는 행동

  2. [우선순위] 작업 설명
     → 실행할 명령어 또는 행동
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 우선순위 레벨

| 레벨 | 태그 | 의미 |
|------|------|------|
| 1 | `[필수]` | 즉시 해결해야 하는 오류/블로커 |
| 2 | `[권장]` | 진행에 도움이 되는 작업 |
| 3 | `[선택]` | 하면 좋지만 필수는 아닌 작업 |
| 4 | `[제안]` | 장기적으로 고려할 작업 |

### 상황별 권장 작업 매트릭스

| 현재 상태 | 권장 작업 |
|----------|----------|
| 프로젝트 미초기화 | `/pm:init` 또는 `/pm:adopt` |
| 오류 발견 | 오류 수정 후 `/pm:validate` |
| 블로커 존재 | 블로커 해결 방안 제시 |
| 진행률 0% | 첫 태스크 시작 제안 |
| 진행률 < 50% | 다음 태스크 제안, `/pm:burndown` |
| 진행률 50-80% | 태스크 계속, `/pm:velocity` 확인 |
| 진행률 > 80% | 마무리 작업, `/pm:auto-report` 제안 |
| 진행률 100% | `/pm:new-report retrospective`, 다음 마일스톤 |
| 테스트 실패 | 테스트 수정, 재실행 |
| 보안 취약점 | `npm audit fix` 또는 수동 패치 |
| 문서 품질 경고 | 문서 보완 제안 |
| 모든 것 정상 | 다음 마일스톤 준비 또는 개선 제안 |

### 명령어별 권장 작업 예시

#### /pm:status 실행 후

```
💡 다음 권장 작업
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  1. [권장] 다음 태스크 시작: "API 엔드포인트 구현"
     → 태스크 완료 후 MILESTONES.md 체크

  2. [선택] 진행 상황 시각화
     → /pm:burndown
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

#### /pm:validate 실행 후 (오류 발견 시)

```
💡 다음 권장 작업 (우선순위순)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  1. [필수] docs/ARCHITECTURE.md 파일 생성
     → /pm:new-plan architecture

  2. [필수] 블로커 해결 필요
     → 담당자에게 API 키 요청

  3. [권장] 실패한 테스트 수정
     → npm test 실행 후 오류 확인
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

#### /pm:sync 실행 후

```
💡 다음 권장 작업
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  1. [권장] 진행 상황 확인
     → /pm:status

  2. [선택] 번다운 차트로 일정 확인
     → /pm:burndown
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

#### 마일스톤 완료 시

```
💡 다음 권장 작업
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  1. [권장] 마일스톤 회고 보고서 작성
     → /pm:new-report retrospective

  2. [권장] 월간 분석 보고서 생성
     → /pm:auto-report monthly

  3. [제안] 다음 마일스톤 계획 수립
     → MILESTONES.md에 다음 마일스톤 추가
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 구현 규칙

1. **항상 출력**: 모든 pm 명령어는 권장 작업 섹션을 포함해야 함
2. **상황 인식**: 현재 프로젝트 상태를 분석하여 적절한 권장 작업 제시
3. **구체적 명령어**: 가능하면 실행할 명령어를 명시
4. **우선순위 정렬**: 필수 > 권장 > 선택 > 제안 순서로 정렬
5. **최대 5개**: 권장 작업은 최대 5개까지만 표시 (과부하 방지)
6. **맥락 유지**: 이전 작업 결과를 고려하여 연속적인 워크플로우 제안
