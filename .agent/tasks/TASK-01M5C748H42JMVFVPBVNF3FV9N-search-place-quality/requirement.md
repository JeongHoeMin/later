# Requirement

## Background / Goal

[MVP 기획](../../../docs/mvp.md)의 남은 작업을 후속 Task로 추적한다. 사용자 승인 범위는 잔여 작업 등록이며 현재 제품 구현 착수를 뜻하지 않는다.

## R1 - 자연어 검색·장소 검증 품질 기준 설계

multilingual-e5-small+pgvector를 기준으로 문서/질의 전처리·모델 실행 자원·색인·검색 계약·평가 데이터를 설계한다. 부산의 고깃집 등 지역+업종 필수 목표, 복수 장소/지점 대조·지도 액션·출처 특징 태그 표시를 구체화한다.

### Acceptance Criteria

- AC-R1-1: 해당 범위의 승인/미확정/보류 결정을 구분해 문서화한다.
- AC-R1-2: 서버/모바일 책임과 검증 방법·추가 구현 Task를 연결한다.
- AC-R1-3: 사용자 직접 태그 입력은 제외한다. 검색/장소 품질은 고정 데이터셋·평가 기준과 실패 사례로 검증한다.

## Service Policy Impact

등록 시점 영향 없음. 기획 문서만 기록한다. 실제 정책 구현 시 [서비스 정책](../../../docs/service-policy.md)을 함께 갱신한다.

## Service Architecture Impact

등록 시점 영향 없음. 구성 변경 구현 시 [서비스 구성](../../../docs/service-architecture.md)을 함께 갱신한다.

## Out of Scope

이 등록 작업에서 제품 코드·배포·결제 상품·미확정 정책을 변경하지 않는다.
