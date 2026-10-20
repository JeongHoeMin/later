# Requirement

## Background / Goal

[MVP 기획](../../../docs/mvp.md)의 남은 작업을 후속 Task로 추적한다. 사용자 승인 범위는 잔여 작업 등록이며 현재 제품 구현 착수를 뜻하지 않는다.

## R1 - MVP 보관·재저장·실패 정책의 잔여 결정

한도 도달 시 미만료 항목 재저장 허용 여부, 최종 분석 실패 항목 보존/폐기 및 검색 포함, 만료 전 알림 시점을 사용자와 확정한다. C/T/A 독립 규칙을 유지한다.

### Acceptance Criteria

- AC-R1-1: 해당 범위의 승인/미확정/보류 결정을 구분해 문서화한다.
- AC-R1-2: 서버/모바일 책임과 검증 방법·추가 구현 Task를 연결한다.
- AC-R1-3: 사용자 정책 선택 전 구현하지 않는다. 구독 상세는 별도 보류 Task다.

## Service Policy Impact

등록 시점 영향 없음. 기획 문서만 기록한다. 실제 정책 구현 시 [서비스 정책](../../../docs/service-policy.md)을 함께 갱신한다.

## Service Architecture Impact

등록 시점 영향 없음. 구성 변경 구현 시 [서비스 구성](../../../docs/service-architecture.md)을 함께 갱신한다.

## Out of Scope

이 등록 작업에서 제품 코드·배포·결제 상품·미확정 정책을 변경하지 않는다.
