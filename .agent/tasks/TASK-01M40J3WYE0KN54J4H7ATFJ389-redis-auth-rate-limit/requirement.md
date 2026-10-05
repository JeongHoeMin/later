# Requirement

## R1 · Redis 공유 카운터

- AC-R1-1: 기존 로그인20/갱신60/로그아웃60/연동IP·회원10의 첫요청60초 창과 429/Retry-After를 유지하고 Redis Lua 원자 검사/증가와 TTL로 공유한다. 이미 초과된 키는 추가 쓰기 없이 거부한다. PostgreSQL 카운터 경로는 DI에서 제거한다.
- AC-R1-2: 키는 기존 해시를 이름공간 아래 저장, 만료는 TTL로 자동 제거, 차단으로 TTL 연장 없음. Redis 장애는500 내부 원문 비노출로 실패하고 DB fallback 없음. 명령1초·연결2초·초기시작5초 제한, 대기열1000개 상한, offline queue 비활성, 재연결·정상 종료 처리.

## R2 · 구성과 문서

- AC-R2-1: Redis URL 검증과 ENV 예시, localhost 전용 Docker Compose/healthcheck/64MB noeviction/영속화없음 설정 및 실행 설명을 추가한다. Docker 데몬 없이 실제 Redis 통합 검증이 가능하도록 개발/테스트 실행 방법을 기록한다.
- AC-R2-2: docs/service-policy.md와 인증 문서/지침의 저장소·장애·TTL·Redis 재시작시 창 초기화 정책을 갱신한다. 기존 PostgreSQL bucket/migration은 기존 기록과 데이터 보존을 위해 유지하되 새 요청에는 사용하지 않는다.

## Out of Scope

운영 Redis 생성/배포, 캐시/큐 기능 추가, 모바일, Redis 외 점검 발견 수정.

## Service Policy Impact

[서비스 정책](../../../docs/service-policy.md)에서 요청 제한 저장소와 TTL/장애/재시작 동작을 갱신한다.
