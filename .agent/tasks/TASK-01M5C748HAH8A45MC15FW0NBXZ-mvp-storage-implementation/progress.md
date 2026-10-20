# Progress

## Current State

pending / requirement. 사용자가 남은 작업을 Task로 등록하도록 명시적으로 요청했다.

## Decisions

Decision: 현재 미구현 Content/SavedItem·사용자 소유권·목록/상세/삭제·정책 스냅샷·C/T/A 조합·재저장/복구·만료 숨김·90일 연결 삭제·180일 무연결 정리를 구현 가능한 작업으로 분해한다. 서버 응답/원자성·모바일 표시/오류·실제 테스트 계약을 작성한다.

Reason: MVP 문서 정리와 후속 설계/구현을 분리해 추적한다.

## Remaining

보관/수집/검색 구현은 해당 정책과 설계가 정해진 뒤 시작한다. 실제 구현 때 service-policy.md 및 service-architecture.md를 코드와 함께 갱신한다.

## Service Policy Update

해당 없음: 후속 작업 등록만 수행한다.

## Service Architecture Update

해당 없음: 코드/구성 변경 없음.

## Issues / Blocker

외부 장애 없음. 미확정 또는 보류 조건은 위에 기록했다.

## Next Action

T-R1-1은 NOT_STARTED. requirement.md와 [MVP](../../../docs/mvp.md)를 확인해 미확정 사항을 논의한다. 제품 구현은 별도 설계/착수 범위를 확정한 뒤 진행한다.
