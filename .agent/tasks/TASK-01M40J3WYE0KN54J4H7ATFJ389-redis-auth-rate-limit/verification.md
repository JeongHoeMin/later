# Verification

## Test Mapping

- AC-R1-1 / T-R1-1: PASS. redis-auth-rate-limit.repository.integration-spec.ts에서 두 instance의 동시40요청 중20허용, 차단 후 카운터 증가/TTL 연장 없음, 독립키·TTL 자동 만료·Retry-After 반올림을 실제 Redis로 검증했다. 기존 HTTP E2E141개로 정책 회귀 검증.
- AC-R1-2 / T-R1-2: PASS. 동일 integration에서 종료 후 실패, 테스트 소유 연결 지연 시1초 deadline/복구,1500요청 대기열 상한, 연결 손실 시 즉시 실패/재연결, 초기 연결5초 제한을 검증했다. URL·원문 비노출 단위 테스트 포함. 연결2초와 offline queue 옵션은 코드 확인, 실제 OOM은 미실행.
- AC-R2-1 / T-R2-1: PASS. URL 단위8개, docker-compose config --quiet, 실제 Redis CONFIG GET으로64MB/noeviction/save없음/appendonly no 확인. Docker 데몬이 없어 컨테이너 기동은 미검증이며 소스 실행 명령을 문서화했다.
- AC-R2-2 / T-R2-2: PASS. canonical service policy와 auth/cleanup README·project 지침을 코드와 대조하고 로컬 링크47개 확인. 기존 schema/migration 보존.

## RED / GREEN / REFACTOR

- RED: PASS. 최소 Redis 선언 상태에서 URL 단위6개 및 실제 Redis 기능5개가 기대 동작 부족으로 실패했다. 로그 /tmp/later-redis-unit-red.log, /tmp/later-redis-db-red.log. 환경 실패는 RED로 집계하지 않았다.
- 추가 RED: PASS. 실제 명령 지연 테스트에서 AbortSignal만 사용하면 기대 reject 대신 성공하여 실패했다. 명시 deadline/연결 복구 후 GREEN.
- GREEN: PASS. Redis 통합9개와 URL 단위8개 통과. 신규 startup/queue/connection loss 테스트는 기존 동작 검증이며 별도 RED를 주장하지 않는다.
- REFACTOR: PASS. 지연 주입을 전용 TCP 프록시로 바꾸고 최종 전체 integration 재실행56개 PASS.

## Final Commands

apps/api에서 pnpm --config.verify-deps-before-run=false로 test(295), test:e2e(141), test:integration(56), exec tsc --noEmit --incremental false, exec eslint(변경 TS7개), build 모두 PASS. 총492개. /tmp/later-redis-full-{unit,e2e,db}.log 및 /tmp/later-redis-final-build.log. Compose config·문서 링크·git diff --check PASS.

테스트는 임시 localhost PostgreSQL later_test와 Redis DB15에서 수행했다. 테스트 소유 키만 삭제하며 FLUSHDB/FLUSHALL 및 서버 전체 PAUSE를 사용하지 않는다. 운영 계정/DB/클라우드와 실제 성능·비용은 미검증이다. 정책 갱신과 검증 완료.
