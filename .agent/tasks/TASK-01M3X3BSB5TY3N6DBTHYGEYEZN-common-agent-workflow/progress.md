# Progress

## Current State

문서 작성과 검증을 완료했다. main 기준 docs/agent-workflow 브랜치를 사용했다. 커밋·PR·병합은 사용자 승인 범위의 배포 절차다.

## Completed

공통 진입점·Workflow·컨벤션·템플릿 네 파일과 이 샘플 Task 작성.

## In Progress

없음.

## Remaining

이 Task의 문서 작업 없음. PR 병합 후 feat/auth 기록은 별도 Task다.

## Decisions

- Decision: 루트 진입점에서 .agent/AGENTS.md를 공통으로 읽는다. Reason: 도구별 규칙 중복을 피하고 자동 탐색 경로에 연결한다.
- Decision: 컨벤션은 project.md, 상태는 Task 네 파일에 둔다. Reason: 전역 규칙과 변경되는 진행 상태를 분리한다.
- Decision: 매번 승인하되 이미 승인된 세트는 끝까지 진행한다. Reason: 기존 사용자 요청을 보존한다.
- Decision: 문서 전용 변경은 TDD 예외다. Reason: 제품 동작 변경이 없으며 구조·링크·YAML·일관성 검증으로 대체한다.
- Decision: 과거 RED 확인 불가와 현재 GREEN을 구분한다. Reason: 사후 기록으로 실행 이력을 만들어내지 않는다.

## Issues / Blocker

없음. 기존 모바일 지침과 직접 충돌은 없다. 모바일의 npx 예시는 pnpm workspace 사용 원칙에 맞게 실행하며 Expo 패키지 설치 규칙은 유지한다.
초안의 'completed는 Next Action 없음'과 '종료 시 항상 Next Action'은 완료 Task의 null과 목록의 다음 작업 제안으로 구분했다.
전체 Project Suite는 변경된 앱 범위로 명확히 했고 문서 작업에는 검증 예외를 명시했다.

## Discovered Requirements

없음.

## Failed Attempts

없음.

## Next Action

없음. 이 문서 Task는 완료했다. 사용자 승인 범위의 PR 병합 및 feat/auth 기록은 후속 절차로 진행한다.

## Task Identity 이관 (2026-10-02)

- 이전 ID: TASK-001
- 새 ID: TASK-01M3X3BSB5TY3N6DBTHYGEYEZN
- Directory: TASK-01M3X3BSB5TY3N6DBTHYGEYEZN-common-agent-workflow
- 승인: 기존 Task도 수정된 지침에 맞춰 정리하라는 사용자의 직접 요청. 일반적인 기존 ID 유지 규칙의 명시적 예외다.
- 기존 created_at은 실제 시각 미상이므로 날짜를 보존했다. 새 ULID의 시각은 이관 시각이며 과거 작업 시각이 아니다.
- 제품 동작·기존 R/AC·RED/GREEN 결과는 보존했다. 문서 전용 이관은 TDD N/A이며 YAML·링크·ID/Directory·상태·diff를 검증한다.

## 병렬 작업 지침 변경

- Decision: 전체 ULID 26자리를 사용한다. Reason: 공식 ULID의 앞 10자리는 시간뿐이고 앞 12자리도 난수가 10비트라 동시 생성 충돌 방지 요구에 부족하다. 80비트 난수를 보존한다.
- Decision: tasks/README.md를 고정 조회 안내로 바꾸고 TASKS.md는 ignored derived view로 취급한다. Reason: 하나의 목록 파일을 여러 Agent가 작업마다 수정하는 충돌을 줄인다.
- Decision: 실제 과거 created_at 날짜를 유지한다. Reason: 이관 시각으로 원래 작업 시각을 덮거나 임의 시각을 만들지 않는다.
- Verification: 서로 다른 임시 checkout의 동일 밀리초 생성 ID·Directory 구분, Dashboard 반복 재생성, 네 문서·YAML·링크·상태·Prettier·diff 검증 PASS. 제품 테스트는 문서 전용이므로 N/A.
- Remaining: 이 Task의 지침·샘플 문서 변경 없음. feat/auth의 나머지 Task 이관은 main 반영 후 승인된 후속 절차에서 진행한다.
