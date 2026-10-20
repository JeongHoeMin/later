# Requirement

## Background / Goal

[MVP 기획](../../../docs/mvp.md)의 남은 작업을 후속 Task로 추적한다. 사용자 승인 범위는 잔여 작업 등록이며 현재 제품 구현 착수를 뜻하지 않는다.

## R1 - MVP 저장·보관 생명주기 서버·모바일 구현 계획

현재 미구현 Content/SavedItem·사용자 소유권·목록/상세/삭제·정책 스냅샷·C/T/A 조합·재저장/복구·만료 숨김·90일 연결 삭제·180일 무연결 정리를 구현 가능한 작업으로 분해한다. 서버 응답/원자성·모바일 표시/오류·실제 테스트 계약을 작성한다.

### Acceptance Criteria

- AC-R1-1: 해당 범위의 승인/미확정/보류 결정을 구분해 문서화한다.
- AC-R1-2: 서버/모바일 책임과 검증 방법·추가 구현 Task를 연결한다.
- AC-R1-3: 보관/수집/검색 구현은 해당 정책과 설계가 정해진 뒤 시작한다. 실제 구현 때 service-policy.md 및 service-architecture.md를 코드와 함께 갱신한다.

## Service Policy Impact

등록 시점 영향 없음. 기획 문서만 기록한다. 실제 정책 구현 시 [서비스 정책](../../../docs/service-policy.md)을 함께 갱신한다.

## Service Architecture Impact

등록 시점 영향 없음. 구성 변경 구현 시 [서비스 구성](../../../docs/service-architecture.md)을 함께 갱신한다.

## Out of Scope

이 등록 작업에서 제품 코드·배포·결제 상품·미확정 정책을 변경하지 않는다.
