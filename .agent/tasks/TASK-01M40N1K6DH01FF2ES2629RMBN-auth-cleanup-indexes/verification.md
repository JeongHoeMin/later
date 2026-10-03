# Verification

## T-R1-1 / R1 Acceptance Criteria

- RED: PASS. 실제 later_test에서 기대 인덱스3개 중0개 및 만료 쿼리 인덱스 누락으로2개 실패(/tmp/later-index-red.log). 초기 PostgreSQL 포트 오류는 RED로 집계하지 않았다.
- GREEN: PASS. migrate deploy 후 카탈로그의 유효 인덱스3개/컬럼과 세 조회의 실제 JSON EXPLAIN에서 해당 인덱스 사용 가능성 확인(/tmp/later-index-green.log).
- migration은 CREATE INDEX3개만 포함하며 기존 데이터/schema 관계를 유지한다. Prisma validate PASS. 운영 성능·migration lock 시간은 미측정.
- REFACTOR: N/A. 추가 인덱스만 구현.

## Final Verification

- Unit299: /tmp/later-cleanup-full-unit.log PASS.
- E2E141: /tmp/later-cleanup-full-e2e.log PASS. mock DB에서 background cleanup 오류 이벤트가 일부 발생하며 Suite 실패와 구분한다.
- Integration60: /tmp/later-cleanup-full-db.log PASS. localhost later_test 및 Redis DB15만 사용, 테스트 소유 데이터 정리. module integration의 실제 scheduler는 대체한다.
- tsc / 변경 TS7개 eslint / build / Prisma validate: PASS. /tmp/later-cleanup-{tsc,lint,build,schema}.log.
- 문서 로컬 링크·두 Task YAML/ID·git diff --check: PASS.
- 정책/구성: service-policy, service-architecture, cleanup README, 운영 점검을 실제 코드/설정과 대조해 갱신 완료.
- 운영/개발 DB migration·배포·실제 클라우드 비용/부하: 미실행.
