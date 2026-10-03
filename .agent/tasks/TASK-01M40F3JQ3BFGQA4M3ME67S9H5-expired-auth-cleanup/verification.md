# Verification

| Test | AC | 실제 테스트 |
| --- | --- | --- |
| T-R1-1 | AC-R1-1~3 | apps/api/src/auth/infrastructure/persistence/prisma-auth-cleanup.repository.integration-spec.ts: 경계 시각 삭제·회원/연결/유효 데이터 보존·토큰 cascade·배치·동시 실행·잠금 건너뛰기·재사용 탐지 유지, 5개 |
| T-R2-1 | AC-R2-1,2 | apps/api/src/auth/infrastructure/cleanup/auth-cleanup.scheduler.spec.ts: 주기·중복 방지·장애 재시도·종료·중복 초기화, 5개; 유스케이스 기준 시각/500개 전달 1개 |

RED: PASS. 최소 선언 상태에서 scheduler 5개가 실행 누락으로 실패하고 실제 DB 4개가 삭제/집계 누락으로 실패했다. import/환경 오류가 아니다. 유스케이스 위임과 유효 토큰 보존 테스트는 처음부터 PASS한 경계·회귀 검증이며 RED로 주장하지 않는다.

GREEN: PASS. 대상 Unit 6개, 실제 DB 5개 통과.

REFACTOR: N/A. 추가 동작 리팩터링 없음, 변경 파일 포맷 정리만 수행.

2026-10-03 전체 API 검증: pnpm test 270개/24파일, pnpm test:e2e 128개/14파일, pnpm test:integration 42개/9파일 PASS. tsc --noEmit --incremental false, 변경 TS eslint, pnpm build PASS. 격리한 later_test PostgreSQL 사용, 운영/개발 DB 변경 없음. 모바일 변경 없음.

독립 리뷰: Critical/Important 결함 없음. 리뷰어도 scheduler Unit 6개 PASS 확인. git diff --check PASS. Task 네 문서와 구현 계약 대조 완료.
