---
description: Check current milestone progress and document status
allowed-tools: [Read, Glob, Grep]
---

# /pm:status

현재 프로젝트 진행 상황을 확인하고, 다음 권장 작업을 안내한다.

## Prerequisites

- `PROJECT.yaml` file must exist
- `MILESTONES.md` file must exist

## Output Information

1. **Milestone info**
   - Current milestone name
   - Progress (% and progress bar)
   - Completed/total tasks
   - Blockers (if any)

2. **Task list**
   - Remaining tasks (unchecked)
   - Completed tasks (checked)

3. **Document status**
   - core_docs list
   - Last modified date for each document
   - File existence status

4. **💡 다음 권장 작업** (필수 출력)
   - 현재 상태에 기반한 다음 작업 제안

## Output Format

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 PM Status — {{ project-name }}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Current Milestone: v0.2.0 — Feature Release
   ████████████░░░░ 67% (8/12)

📝 Remaining Tasks:
   - [ ] API 엔드포인트 구현
   - [ ] 테스트 작성
   - [ ] 문서화
   - [ ] [BLOCKED] 외부 API 연동

✅ Completed Tasks:
   - [x] 프로젝트 구조 설정
   - [x] 데이터베이스 스키마 설계
   ... (6 more)

⚠️ Blockers: 1개
   - 외부 API 연동: API 키 발급 대기 중

📁 Document Status:
   vision     │ MANIFESTO.md    │ 3 days ago  │ ✓
   progress   │ MILESTONES.md   │ today       │ ✓
   api_spec   │ docs/API.md     │ 7 days ago  │ ✓

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 다음 권장 작업
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  1. [필수] 블로커 해결: API 키 발급 요청
     → 담당자에게 연락 후 MILESTONES.md 업데이트

  2. [권장] 다음 태스크 시작: "API 엔드포인트 구현"
     → 완료 후 체크박스 표시

  3. [선택] 진행 상황 시각화
     → /pm:burndown
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Recommended Actions Logic

상황에 따른 권장 작업 결정:

| 진행률 | 블로커 | 권장 작업 |
|--------|--------|----------|
| 0% | 없음 | 첫 태스크 시작 제안 |
| 1-50% | 없음 | 다음 태스크 제안, /pm:burndown |
| 1-50% | 있음 | 블로커 해결 우선 |
| 51-80% | 없음 | 태스크 계속, /pm:velocity 확인 |
| 81-99% | 없음 | 마무리 태스크 집중 |
| 100% | 없음 | /pm:new-report retrospective, 다음 마일스톤 |
