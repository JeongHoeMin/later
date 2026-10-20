# Requirement

## Background / Goal

[MVP 기획](../../../docs/mvp.md)의 남은 작업을 후속 Task로 추적한다. 사용자 승인 범위는 잔여 작업 등록이며 현재 제품 구현 착수를 뜻하지 않는다.

## R1 - 지원 콘텐츠별 수집·AI 분석 경로 구체화

지도/SNS/유튜브/상품/블로그/일반웹/뉴스/PDF/이미지/GitHub의 지원 도메인·URL 판별·단축URL 해석·중복 정규화·필수 필드·수집 깊이를 정한다. OCR/영상 전사 범위, 접근 불가와 AI 필요 여부, 외부 수집 조건·성공률·실제 단위 원가를 검증한다.

### Acceptance Criteria

- AC-R1-1: 해당 범위의 승인/미확정/보류 결정을 구분해 문서화한다.
- AC-R1-2: 서버/모바일 책임과 검증 방법·추가 구현 Task를 연결한다.
- AC-R1-3: 새 사이트/모델/API 지원을 검증 없이 구현 완료로 표시하지 않는다. 사이트별 표본과 성공/실패 근거가 필요하다.

## Service Policy Impact

등록 시점 영향 없음. 기획 문서만 기록한다. 실제 정책 구현 시 [서비스 정책](../../../docs/service-policy.md)을 함께 갱신한다.

## Service Architecture Impact

등록 시점 영향 없음. 구성 변경 구현 시 [서비스 구성](../../../docs/service-architecture.md)을 함께 갱신한다.

## Out of Scope

이 등록 작업에서 제품 코드·배포·결제 상품·미확정 정책을 변경하지 않는다.
