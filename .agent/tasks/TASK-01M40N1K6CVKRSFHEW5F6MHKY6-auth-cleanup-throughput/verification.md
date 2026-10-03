# Verification

## T-R1-1 / R1 Acceptance Criteria

- RED: PASS. scheduler/usecase10개가 즉시 실행·반복·집계·상한 미구현으로 기대 실패(/tmp/later-cleanup-red.log). 환경 경로 오류는 RED로 집계하지 않았다.
- GREEN: PASS. 동일 파일10개 통과. 단조 시각 예산·max10·동일 cutoff·500미만 종료·재시도·중복/종료 검증.
- 추가 RED: Apple 모듈 sentinel이 즉시 scheduler에 의해 삭제되어 보존 기대 실패(/tmp/later-cleanup-isolation-red.log). 두 DB 모듈에서 scheduler 경계 대체 후 전체 integration PASS.
- 실제 DB 회귀: 501행 다중 배치, 유효행 보존, 뒤 배치 오류 후 이전500행 커밋 유지 및 잔여 재시도, 기존 잠금/경계/동시성/토큰 재사용 탐지 검증. 신규 DB 회귀는 이미 구현 후 작성하여 별도 RED로 주장하지 않는다.
- REFACTOR: N/A. 요구 동작 구현과 리뷰 지적 보완만 수행.

## Final Verification

- Unit299: /tmp/later-cleanup-full-unit.log PASS.
- E2E141: /tmp/later-cleanup-full-e2e.log PASS. mock DB에서 background cleanup 오류 이벤트가 일부 발생하며 Suite 실패와 구분한다.
- Integration60: /tmp/later-cleanup-full-db.log PASS. localhost later_test 및 Redis DB15만 사용, 테스트 소유 데이터 정리. module integration의 실제 scheduler는 대체한다.
- tsc / 변경 TS7개 eslint / build / Prisma validate: PASS. /tmp/later-cleanup-{tsc,lint,build,schema}.log.
- 문서 로컬 링크·두 Task YAML/ID·git diff --check: PASS.
- 정책/구성: service-policy, service-architecture, cleanup README, 운영 점검을 실제 코드/설정과 대조해 갱신 완료.
- 운영/개발 DB migration·배포·실제 클라우드 비용/부하: 미실행.
