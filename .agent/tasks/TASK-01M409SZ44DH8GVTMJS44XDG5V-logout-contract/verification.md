# Verification

| 테스트 | AC        | 실제 파일과 검증                                                                                                                                    |
| ------ | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-R1-1 | AC-R1-1,3 | src/auth/application/logout-session.use-case.spec.ts: 해시 전달·반복 호출·장애 보존                                                                 |
| T-R1-2 | AC-R1-1,3 | test/session-lifecycle.e2e-spec.ts: 로그아웃 204·잘못된 입력 400                                                                                    |
| T-R1-3 | AC-R1-2   | src/auth/infrastructure/persistence/prisma-auth-session.repository.integration-spec.ts: 해당 세션만 폐기·반복·다른 세션 유지·알 수 없는 토큰 무동작 |

RED: N/A — 기존 기능의 회귀 검증이다. 새 구현을 추가하지 않았다.
GREEN: PASS — 위 테스트와 전체 API 검증.
REFACTOR: N/A — 로그아웃 동작 변경 없음.

## 전체 검증

Unit 264/23 files, E2E 128/14 files, Integration 37/8 files PASS. 타입·변경 TS lint·Nest build·Prisma validate·DB/schema diff·git diff --check PASS. Markdown 로컬 링크와 Task YAML 검증 PASS.

초기 Prisma 생성 파일 누락, sandbox listen EPERM, 테스트 DB 누락은 환경 오류이며 RED가 아니다. Prisma generate와 권한 E2E 실행, /tmp의 격리된 PostgreSQL 18.4 later_test로 해소했다. 제품 의존성·개발 DB·운영 DB는 변경하지 않았다. 기존 Vite 경고는 비실패다.
