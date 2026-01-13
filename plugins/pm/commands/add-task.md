---
description: Analyze remaining tasks and add new task to plan
argument-hint: <task-name> [--after <task>|--before <task>|--position <n>]
allowed-tools: [Read, Edit, Grep, Glob]
---

# /pm:add-task

잔여 작업을 분석하고, 새 작업을 MILESTONES.md의 지정 위치에 추가한다.

## Prerequisites

- `PROJECT.yaml` file must exist
- `MILESTONES.md` file must exist

## Usage

```bash
# 마지막에 추가 (기본)
/pm:add-task "새 기능 구현"

# 특정 작업 뒤에 추가
/pm:add-task "통합 테스트 작성" --after "단위 테스트 작성"

# 특정 작업 앞에 추가
/pm:add-task "DB 스키마 설계" --before "API 구현"

# 특정 위치(번호)에 추가
/pm:add-task "긴급 버그 수정" --position 1

# 블로커 태그와 함께 추가
/pm:add-task "외부 API 연동" --blocked "API 키 대기"

# 여러 작업 한번에 추가
/pm:add-task "작업1" "작업2" "작업3"
```

## Arguments

| 인자 | 설명 |
|------|------|
| `<task-name>` | 추가할 작업 이름 (필수, 복수 가능) |
| `--after <task>` | 지정 작업 뒤에 추가 |
| `--before <task>` | 지정 작업 앞에 추가 |
| `--position <n>` | n번째 위치에 추가 (1부터 시작) |
| `--blocked <reason>` | 블로커와 함께 추가 |

## Operation

1. **잔여 작업 분석**
   - MILESTONES.md에서 현재 마일스톤의 태스크 파싱
   - 완료/미완료 작업 분류
   - 블로커 식별

2. **삽입 위치 결정**
   - `--after`: 지정 작업 바로 다음 줄
   - `--before`: 지정 작업 바로 앞 줄
   - `--position`: 미완료 작업 중 n번째 위치
   - 기본: 미완료 작업 목록 마지막

3. **작업 추가**
   - `- [ ] {task-name}` 형식으로 추가
   - `--blocked` 옵션 시: `- [ ] [BLOCKED] {task-name}`

4. **진행률 재계산**
   - 자동으로 Progress 업데이트

## Output Format

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
➕ PM Add Task — {{ project-name }}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 현재 마일스톤: v0.2.0 — Feature Release

📊 잔여 작업 분석:
   총 작업: 12개
   완료: 8개 (67%)
   미완료: 4개
   블로커: 1개

📝 미완료 작업 목록:
   1. [ ] API 엔드포인트 구현
   2. [ ] 테스트 작성
   3. [ ] 문서화
   4. [ ] [BLOCKED] 외부 API 연동

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ 작업 추가 완료

   위치: #3 (테스트 작성 뒤)
   작업: "통합 테스트 작성"

📝 업데이트된 작업 목록:
   1. [ ] API 엔드포인트 구현
   2. [ ] 테스트 작성
   3. [ ] 통합 테스트 작성  ← NEW
   4. [ ] 문서화
   5. [ ] [BLOCKED] 외부 API 연동

📊 진행률: 67% → 62% (8/13)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 다음 권장 작업
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  1. [권장] 추가된 작업 시작
     → "통합 테스트 작성"

  2. [선택] 작업 우선순위 재정렬
     → /pm:reorder-tasks

  3. [선택] 현재 상태 확인
     → /pm:status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Smart Position Suggestion

위치 미지정 시 스마트 추천:

| 작업 키워드 | 추천 위치 | 이유 |
|-------------|-----------|------|
| `test`, `테스트` | 구현 작업 뒤 | 구현 후 테스트 |
| `doc`, `문서` | 마지막 | 완료 후 문서화 |
| `fix`, `버그`, `hotfix` | 첫 번째 | 우선 처리 |
| `refactor`, `리팩토링` | 테스트 뒤 | 안정성 확보 후 |
| `deploy`, `배포` | 마지막 | 모든 작업 완료 후 |

```
💡 위치 추천: #2 (API 엔드포인트 구현 뒤)
   이유: "테스트" 키워드 감지 → 구현 작업 뒤 배치 권장

   이 위치로 추가할까요? (Y/n)
```

## Batch Add Mode

여러 작업 추가 시:

```bash
/pm:add-task "작업1" "작업2" "작업3" --after "기준작업"
```

```
✓ 3개 작업 추가 완료

   #3: 작업1  ← NEW
   #4: 작업2  ← NEW
   #5: 작업3  ← NEW
```

## Error Handling

| 에러 | 메시지 |
|------|--------|
| 작업명 미입력 | `Error: 작업명을 입력해주세요` |
| 기준 작업 없음 | `Error: "기준작업"을 찾을 수 없습니다. 미완료 작업 목록을 확인하세요.` |
| 중복 작업 | `Warning: 동일한 작업이 이미 존재합니다. 계속 추가할까요? (y/N)` |
| 위치 범위 초과 | `Error: position 15는 범위를 벗어났습니다 (최대: 5)` |

## Related Commands

- `/pm:status` - 현재 진행 상황 확인
- `/pm:sync` - 진행률 동기화
- `/pm:validate` - 프로젝트 무결성 검증
