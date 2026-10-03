# Verification

| 테스트 | AC          | 실제 파일과 검증                                                                                                                                    |
| ------ | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-R1-1 | AC-R1-1,3,4 | test/account-withdrawal.e2e-spec.ts: 본인 삭제 204, query 무시, 다른 기기 JWT·탈퇴 JWT 401, 미인증 401, 회원 조회 장애 500, OpenAPI                 |
| T-R1-2 | AC-R1-2~4   | src/users/infrastructure/persistence/prisma-user-account.repository.integration-spec.ts: cascade·타 회원 보존·모든 토큰 무효·재가입 새 ID·반복 삭제 |
| T-R1-3 | AC-R1-3     | test/access-token.e2e-spec.ts 및 test/authenticated-user.e2e-spec.ts: 기존 Guard와 회원 API 회귀                                                    |

RED: PASS — 탈퇴 E2E 4개 실패: DELETE 404, 삭제 회원의 /auth/me 200, Swagger 경로 없음. /tmp/later-account-red.log에서 확인했다.
GREEN: PASS — 탈퇴 HTTP 및 실제 DB cascade·재가입 검증. 추가 장애 테스트는 GREEN 이후 회귀 보강이다.
REFACTOR: PASS — UserAccountModule 재export로 소비자 모듈의 Guard DI를 지원했다. 기존 fake DB fixture의 연결 hooks·회원 경계를 보강하고 전체 E2E를 다시 확인했다.

## 전체 검증

Unit 264/23 files, E2E 128/14 files, Integration 37/8 files PASS. 타입·변경 TS lint·Nest build·Prisma validate·DB/schema diff·git diff --check PASS. Markdown 로컬 링크와 Task YAML 검증 PASS.

초기 Prisma 생성 파일 누락, sandbox listen EPERM, 테스트 DB 누락은 환경 오류이며 RED가 아니다. Prisma generate와 권한 E2E 실행, /tmp의 격리된 PostgreSQL 18.4 later_test로 해소했다. 제품 의존성·개발 DB·운영 DB는 변경하지 않았다. 기존 Vite 경고는 비실패다.
