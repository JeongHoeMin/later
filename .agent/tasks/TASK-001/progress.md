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
