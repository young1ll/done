---
description: Full project and system integrity validation (11 checks)
allowed-tools: [Read, Glob, Grep, Bash]
---

# /pm:validate

프로젝트와 시스템의 전체 무결성을 11가지 관점에서 검증한다.

## Prerequisites

- `PROJECT.yaml` 파일 필수
- Git 저장소 권장 (시스템 검증용)

## Validation Categories

### Part A: 문서 무결성 (Documentation Integrity)

#### 1. 구조 검증 (Structure)
- PROJECT.yaml 필수 필드 (name, core_docs)
- core_docs.vision 정의 여부
- core_docs.progress 정의 여부
- plans_dir, reports_dir 디렉토리 존재

#### 2. 문서 존재 검증 (Document Existence)
- core_docs에 정의된 모든 파일 존재 확인
- 각 문서 역할(role)별 파일 경로 검증

#### 3. 문서 품질 검증 (Document Quality)
- 빈 파일 감지
- 템플릿 플레이스홀더 잔존 ({{ }}, [TODO], [TBD])
- 오래된 문서 (30일 이상 미수정) — `stale_documents` 규칙으로 무시 가능

#### 4. 일관성 검증 (Consistency)
- docs/*.md 중 core_docs에 미등록된 문서 — `unregistered_docs` 규칙으로 무시 가능
- MILESTONES.md 진행률 동기화 상태

#### 5. 정리 필요 검사 (Cleanup)
- 오래된 DRAFT 문서 (14일 이상) — `old_drafts` 규칙으로 무시 가능
- 임시/백업 파일 (.bak, ~, .tmp) — `temp_files` 규칙으로 무시 가능

#### 6. 진행 상태 검증 (Progress)
- 현재 마일스톤 정보
- 전체 태스크 진행률
- 블로커 존재 여부 ([BLOCKED], [WAITING] 태그)

---

### Part B: 시스템 무결성 (System Integrity)

#### 7. 코드 품질 검증 (Code Quality)

프로젝트 타입에 따라 적절한 도구 실행:

| 프로젝트 타입 | 린터 | 타입 체크 | 포맷터 |
|--------------|------|----------|--------|
| Node.js | eslint | tsc --noEmit | prettier --check |
| Python | ruff/pylint | mypy | black --check |
| Go | golint | go vet | gofmt -l |
| Rust | clippy | cargo check | rustfmt --check |

**검증 방법:**
```bash
# package.json scripts 확인
grep -E '"lint"|"type-check"|"typecheck"' package.json

# 또는 직접 실행
npx eslint . --max-warnings 0
npx tsc --noEmit
```

**결과 해석:**
- ✓ 린터/타입 체크 통과
- ⚠ 경고 N개 발견
- ✗ 오류 N개 발견

#### 8. 테스트 상태 검증 (Test Status)

**검증 항목:**
- 테스트 파일 존재 여부 (`tests/`, `__tests__/`, `*.test.*`, `*_test.*`)
- 테스트 스크립트 존재 (`npm test`, `pytest`, `go test`)
- 테스트 실행 결과 (통과/실패)

**검증 방법:**
```bash
# 테스트 파일 존재 확인
find . -name "*.test.*" -o -name "*_test.*" | head -5

# 테스트 실행 (dry-run 또는 실제 실행)
npm test --if-present 2>&1 | tail -10
```

**결과 해석:**
- ✓ 테스트 통과 (N/N passed)
- ⚠ 테스트 일부 실패 (N/M passed)
- ✗ 테스트 실행 불가

#### 9. 빌드 상태 검증 (Build Status)

**검증 항목:**
- 빌드 스크립트 존재 여부
- 빌드 성공 여부 (최근 빌드 또는 실행)

**검증 방법:**
```bash
# 빌드 스크립트 확인
grep -E '"build"' package.json

# 빌드 실행
npm run build 2>&1 | tail -5
```

**결과 해석:**
- ✓ 빌드 성공
- ⚠ 빌드 경고 있음
- ✗ 빌드 실패

#### 10. 의존성 검증 (Dependencies)

**검증 항목:**
- Lockfile 동기화 상태 (package-lock.json, yarn.lock, pnpm-lock.yaml)
- Outdated 패키지 존재
- 보안 취약점 존재

**검증 방법:**
```bash
# Lockfile 동기화 확인
npm ci --dry-run 2>&1 | grep -i "out of sync"

# Outdated 패키지 확인
npm outdated --json 2>/dev/null | head -20

# 보안 취약점 확인
npm audit --json 2>/dev/null | jq '.metadata.vulnerabilities'
```

**결과 해석:**
- ✓ 의존성 정상
- ⚠ Outdated 패키지 N개 (major: N, minor: N)
- ✗ 보안 취약점 N개 (critical: N, high: N)

#### 11. 환경 설정 검증 (Environment)

**검증 항목:**
- .env.example 존재 시 .env와 비교
- 필수 환경 변수 설정 여부
- 설정 파일 일관성 (tsconfig.json, .eslintrc 등)

**검증 방법:**
```bash
# .env.example과 .env 비교
diff <(grep -E "^[A-Z_]+=" .env.example | cut -d= -f1 | sort) \
     <(grep -E "^[A-Z_]+=" .env | cut -d= -f1 | sort) 2>/dev/null

# 필수 설정 파일 존재 확인
ls -la tsconfig.json .eslintrc* .prettierrc* 2>/dev/null
```

**결과 해석:**
- ✓ 환경 설정 정상
- ⚠ .env 누락 변수 N개
- ✗ 필수 설정 파일 누락

---

## Output Format

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 PM Validate — {{ project-name }}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📚 Part A: 문서 무결성
────────────────────────────────────────────────────────

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
  ✓ MILESTONES 진행률 동기화됨 (67%)

🧹 5. 정리 필요 검사
  ✓ 정리가 필요한 파일 없음

📊 6. 진행 상태 검증
  ℹ 현재 마일스톤: v0.2.0
  ℹ 태스크: 8/12 완료 (4 남음)
  ⚠ 블로커 1개 발견

────────────────────────────────────────────────────────

⚙️ Part B: 시스템 무결성
────────────────────────────────────────────────────────

🔍 7. 코드 품질 검증
  ✓ ESLint: 통과
  ✓ TypeScript: 타입 오류 없음

🧪 8. 테스트 상태 검증
  ✓ 테스트 파일: 15개 발견
  ⚠ 테스트 결과: 42/45 통과 (3 실패)

🏗️ 9. 빌드 상태 검증
  ✓ 빌드 성공

📦 10. 의존성 검증
  ✓ Lockfile 동기화됨
  ⚠ Outdated 패키지: 5개
  ⚠ 보안 취약점: 2개 (moderate)

🔧 11. 환경 설정 검증
  ✓ .env 설정 완료
  ✓ tsconfig.json 존재

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 검증 결과 요약
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  문서 무결성:  ✓ 8  ⚠ 2  ✗ 1
  시스템 무결성: ✓ 6  ⚠ 3  ✗ 0
  ─────────────────────────
  전체:         ✓ 14 ⚠ 5  ✗ 1

  상태: ⚠ 경고 및 오류 발견 — 검토가 필요합니다

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 권장 작업 (우선순위순)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  1. [필수] docs/ARCHITECTURE.md 파일 생성
     → /pm:new-plan architecture 또는 직접 생성

  2. [필수] 블로커 해결: API 인증 토큰 발급 대기
     → 블로커 해결 후 /pm:sync 실행

  3. [권장] 실패한 테스트 3개 수정
     → npm test 실행하여 상세 확인

  4. [권장] 보안 취약점 검토
     → npm audit fix 또는 수동 패치

  5. [선택] MANIFESTO.md 플레이스홀더 작성
     → 문서 내용 보완

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## ignore Configuration

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

---

## Validation Mode Options

validate는 선택적으로 범위를 지정할 수 있다:

```bash
/pm:validate           # 전체 검증 (기본)
/pm:validate docs      # 문서 무결성만 (Part A)
/pm:validate system    # 시스템 무결성만 (Part B)
/pm:validate quick     # 빠른 검증 (빌드/테스트 실행 생략)
```

---

## Recommended Actions Logic

검증 결과에 따른 권장 작업 결정 로직:

| 조건 | 우선순위 | 권장 작업 |
|------|---------|----------|
| ✗ 오류 존재 | 1 (필수) | 오류 수정 방법 안내 |
| 블로커 존재 | 2 (필수) | 블로커 해결 방안 |
| 테스트 실패 | 3 (권장) | 테스트 수정 |
| 보안 취약점 (high+) | 4 (권장) | 취약점 패치 |
| ⚠ 경고 존재 | 5 (선택) | 경고 해결 방법 |
| 진행률 < 50% | 6 (제안) | 태스크 시작 제안 |
| 진행률 > 80% | 6 (제안) | 완료 준비 제안 |
| 모두 정상 | 7 (제안) | 다음 마일스톤 준비 |

---

## CLI Script

```bash
${CLAUDE_PLUGIN_ROOT}/skills/pm/scripts/pm validate [docs|system|quick]
```
