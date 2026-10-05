# Requirement

## R1

- AC-R1-1: provider별 성공/인증실패/장애/초과·처리시간·현재/최대 진행량과 cleanup 성공/실패·건수·연속실패/상한 도달을 고정 키로 집계한다.
- AC-R1-2: 5분마다 집계 structured log, 종료 시 마지막 집계. 요청마다 metric log/DB 조회 없음. 토큰/회원/IP/원문 비노출, 자료구조 고정4provider. provider/cleanup 동작은 지표 문제로 변경되지 않는다.

## Service Policy Impact

[서비스 정책](../../../docs/service-policy.md)의 제공자 동시 처리/503·재시도 조건을 갱신한다. 지표는 사용자 정책 변경 없음.

## Service Architecture Impact

[서비스 구성](../../../docs/service-architecture.md)에 인스턴스 gate와5분 집계 로그/운영 수집 미적용을 기록한다.

## Out of Scope

fleet 전역 Redis semaphore·circuit breaker·운영 알림 전송/관측 배포·모바일·DB migration.
