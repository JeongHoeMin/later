# Requirement

## R1

- AC-R1-1: 모든 로그인/연동에 동일 제공자 gate를 공유하고 API 인스턴스별/provider별 기본10개, ENV로1~100개를 허용한다. 초과는 queue/제공자 호출 없이 Unavailable(503).
- AC-R1-2: 성공/실패 모두 슬롯 해제, 타 제공자는 독립. 기존 requestContext/owner 전달과 도메인401/503 의미 유지.

## Service Policy Impact

[서비스 정책](../../../docs/service-policy.md)의 제공자 동시 처리/503·재시도 조건을 갱신한다. 지표는 사용자 정책 변경 없음.

## Service Architecture Impact

[서비스 구성](../../../docs/service-architecture.md)에 인스턴스 gate와5분 집계 로그/운영 수집 미적용을 기록한다.

## Out of Scope

fleet 전역 Redis semaphore·circuit breaker·운영 알림 전송/관측 배포·모바일·DB migration.
