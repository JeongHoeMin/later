# Verification

| 테스트 | AC                   | 실제 파일과 검증                                                                                                                                            |
| ------ | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-R1-1 | AC-R1-1,4            | src/auth/application/link-social-account.use-case.spec.ts: 제공자 검증·검증된 subject만 연결·Apple 회원 전달·Naver grant 소비·장애 보존                     |
| T-R1-2 | AC-R1-1~4, AC-R2-1~3 | test/social-account-link.e2e-spec.ts: 동일 회원 로그인·세션 미발급·409·401/503·임의 입력 400·미인증 401·시도 바인딩·혼용 거부·일회성·OpenAPI                |
| T-R1-3 | AC-R1-2,3            | src/users/infrastructure/persistence/prisma-user-account.repository.integration-spec.ts: 반복·충돌·동일 회원 동일/다른 계정 및 타 회원 동일 계정 동시성 3종 |
| T-R2-1 | AC-R2-1~3            | naver-login-flow.spec.ts 및 start-apple-login.use-case.spec.ts: 회원에 묶인 시도. apple-auth-provider.spec.ts: 서명·nonce 확인 후 회원 전달 회귀 보강       |
| T-R2-2 | AC-R2-2,3            | 신규 실제 DB integration: Apple/Naver의 일반 로그인·타 회원 혼용 거부, 실패 미소비, 정상 일회 소비                                                          |
| T-R2-3 | AC-R2-4              | 임시 later_test에 기존 및 신규 5개 migration deploy PASS. SQL·schema 일치와 cascade·unique 검토                                                             |

RED: PASS — 연동 UseCase 최소 선언 후 8개 기대 실패, 시도 바인딩 3개 기대 실패와 기존 8개 PASS, 미구현 HTTP 14개 실패. 실행 근거는 /tmp/later-link-unit-red.log, /tmp/later-link-attempt-red.log, /tmp/later-link-http-red.log다.
GREEN: PASS — Unit·HTTP·실제 DB 검증. DB integration은 구현 후 검증이며 DB RED를 사후 주장하지 않는다.
REFACTOR: PASS — Naver grant 소비를 sign-in에서 분리했다. 기존 로그인·일회성 보호·알 수 없는 DB 오류 보존을 전체 회귀로 확인했다.

## 전체 검증

Unit 264/23 files, E2E 128/14 files, Integration 37/8 files PASS. 타입·변경 TS lint·Nest build·Prisma validate·DB/schema diff·git diff --check PASS. Markdown 로컬 링크와 Task YAML 검증 PASS.

초기 Prisma 생성 파일 누락, sandbox listen EPERM, 테스트 DB 누락은 환경 오류이며 RED가 아니다. Prisma generate와 권한 E2E 실행, /tmp의 격리된 PostgreSQL 18.4 later_test로 해소했다. 제품 의존성·개발 DB·운영 DB는 변경하지 않았다. 기존 Vite 경고는 비실패다.
