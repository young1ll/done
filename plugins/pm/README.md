# PM Plugin for Claude Code

프로젝트 문서 관리 및 작업 흐름 조율 플러그인.

PROJECT.yaml 기반 체계적 문서 관리, 마일스톤 추적, **문서 + 시스템 무결성 검증**, 분석 보고서를 제공합니다.

**핵심 특징:**
- 11가지 항목의 프로젝트 무결성 검증 (문서 6 + 시스템 5)
- 모든 명령어에서 **다음 권장 작업 자동 안내**
- 번다운 차트, velocity 분석, 자동 보고서 생성

## 설치

```bash
# Claude Code에서
/plugins add pm@done
```

## 명령어

### 기본 명령어

| 명령어 | 설명 |
|--------|------|
| `/pm:help` | PM 플러그인 도움말 표시 |
| `/pm:init [project-name]` | 새 프로젝트 문서 체계 초기화 |
| `/pm:status` | 마일스톤 진행률, 문서 상태, 권장 작업 안내 |
| `/pm:validate` | 문서 + 시스템 무결성 검증 (11가지 항목) |
| `/pm:new-plan <name>` | 새 계획 문서 생성 |
| `/pm:new-report <topic> [type]` | 보고서 생성 |
| `/pm:sync` | MILESTONES.md 진행률 자동 동기화 |
| `/pm:adopt` | 기존 프로젝트에 PM 문서 체계 도입 |

### 분석 명령어

| 명령어 | 설명 |
|--------|------|
| `/pm:burndown` | ASCII 번다운 차트 생성 |
| `/pm:velocity` | 마일스톤별 velocity 분석 |
| `/pm:auto-report [type]` | 자동 보고서 생성 (daily/weekly/monthly) |
| `/pm:code-changes` | git 기반 코드 변경 분석 |

## 문서 체계

### PROJECT.yaml

프로젝트 루트에 생성되는 설정 파일:

```yaml
name: my-project
version: 0.1.0

core_docs:
  vision: docs/MANIFESTO.md
  progress: docs/MILESTONES.md

plans_dir: docs/plans
reports_dir: docs/reports
```

### 핵심 문서

- **MANIFESTO.md**: 프로젝트 비전, 목표, 핵심 가치
- **MILESTONES.md**: 마일스톤 및 태스크 진행 추적

### 보고서 유형

| 유형 | 설명 | 용도 |
|------|------|------|
| `implementation` | 구현 보고서 (기본) | 기능 완료 후 |
| `experiment` | 실험 보고서 | ML 실험 결과 |
| `decision` | 결정 기록 (ADR) | 기술 결정 |
| `retrospective` | 회고 보고서 | 스프린트/마일스톤 회고 |

## 검증 항목 (/pm:validate)

### Part A: 문서 무결성 (6가지)

1. **📁 구조 검증**: PROJECT.yaml 필수 필드
2. **📄 문서 존재**: core_docs 파일 존재 확인
3. **📝 문서 품질**: 빈 파일, 템플릿 플레이스홀더, 오래된 문서
4. **🔗 일관성**: 미등록 문서, 진행률 동기화 상태
5. **🧹 정리 필요**: 오래된 DRAFT, 임시 파일
6. **📊 진행 상황**: 마일스톤 정보, 블로커 존재

### Part B: 시스템 무결성 (5가지)

7. **🔍 코드 품질**: 린터, 타입 체크, 포맷터 실행
8. **🧪 테스트 상태**: 테스트 존재 및 통과 여부
9. **🏗️ 빌드 상태**: 빌드 스크립트 존재 및 성공 여부
10. **📦 의존성**: outdated 패키지, 보안 취약점
11. **🔧 환경 설정**: .env 일관성, 설정 파일 존재

### 검증 모드

```bash
/pm:validate           # 전체 검증 (기본)
/pm:validate docs      # 문서 무결성만
/pm:validate system    # 시스템 무결성만
/pm:validate quick     # 빠른 검증 (빌드/테스트 실행 생략)
```

## ignore 설정

PROJECT.yaml에서 검증 제외 항목 설정:

```yaml
ignore:
  files:
    - "docs/archived/*"
    - "*.bak"
  rules:
    # 문서 관련
    - unregistered_docs
    - stale_documents
    - old_drafts
    - temp_files
    # 시스템 관련
    - outdated_packages    # outdated 패키지 경고 무시
    - security_low         # low severity 취약점 무시
    - test_coverage        # 커버리지 검사 무시
```

## 에이전트

| 에이전트 | 설명 |
|----------|------|
| `project-analyzer` | 프로젝트 구조 분석 및 문서 제안 |
| `milestone-tracker` | 마일스톤 진행 추적 및 블로커 식별 |
| `analytics-reporter` | 자동 보고서 생성 및 트렌드 분석 |
| `code-analyzer` | git 코드 변경 패턴 분석 |

## 라이선스

MIT
