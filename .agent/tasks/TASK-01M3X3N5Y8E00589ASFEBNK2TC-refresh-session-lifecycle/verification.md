# Verification

이 문서는 카카오·네이버 추가 전 사후 기록 baseline이다. 아래의 현재 상태·검증 수치·미구현 설명은 당시 기록 기준이며 이번 문서 이관의 실행 결과와 구분한다. 최신 제공자 상태는 [네이버 Task](../TASK-01M3X3N5YE122YB2CP9Z2642J7-naver-social-auth/task.yaml)를 참고한다.

사후 baseline 기록이다. 아래 모든 Case의 RED와 REFACTOR는 **N/A (과거 실행 로그 확인 불가)**다.
현재 테스트가 PASS하더라도 과거 Test First를 증명하지 않는다. 코드를 되돌려 RED를 재현하지 않는다.

## T-R1-1

- Requirement / AC: R1 / AC-R1-1
- Behavior: 로그인마다 별도 세션을 생성하고 해시만 저장하며 저장 실패 시 토큰을 응답하지 않는다.
- Verification Type: UNIT
- Test: `apps/api/src/auth/application/issue-session.use-case.spec.ts` — 「30일 세션에 해시만 저장하고 원문과 Access Token을 반환한다」와 같은 파일의 관련 사례.
- RED: N/A (사후 기록·확인 불가)
- GREEN: PASS (2026-10-02 현재 재검증)
- REFACTOR: N/A (과거 실행 로그 확인 불가)
- Result: PASS

## T-R2-1

- Requirement / AC: R2 / AC-R2-1
- Behavior: 기존 토큰을 소비하고 같은 세션에 새 해시를 저장하며 원래 만료 시점을 유지한다.
- Verification Type: INTEGRATION
- Test: `apps/api/src/auth/infrastructure/persistence/prisma-auth-session.repository.integration-spec.ts` — 「기존 토큰을 소비하고 같은 세션에 새 해시를 저장한다」와 같은 파일의 관련 사례.
- RED: N/A (사후 기록·확인 불가)
- GREEN: PASS (2026-10-02 현재 재검증)
- REFACTOR: N/A (과거 실행 로그 확인 불가)
- Result: PASS

## T-R3-1

- Requirement / AC: R3 / AC-R3-1
- Behavior: 이미 소비한 토큰을 제출하면 해당 세션을 폐기해 새 토큰도 사용할 수 없다.
- Verification Type: INTEGRATION
- Test: `apps/api/src/auth/infrastructure/persistence/prisma-auth-session.repository.integration-spec.ts` — 「소비한 토큰 재사용은 세션을 폐기하고 새 토큰도 무효화한다」와 같은 파일의 관련 사례.
- RED: N/A (사후 기록·확인 불가)
- GREEN: PASS (2026-10-02 현재 재검증)
- REFACTOR: N/A (과거 실행 로그 확인 불가)
- Result: PASS

## T-R4-1

- Requirement / AC: R4 / AC-R4-1
- Behavior: 동시 갱신은 한 번만 성공하고 재사용으로 폐기한다. 새 해시 저장 실패는 소비도 롤백한다.
- Verification Type: INTEGRATION
- Test: `apps/api/src/auth/infrastructure/persistence/prisma-auth-session.repository.integration-spec.ts` — 「같은 토큰의 동시 갱신은 한 번만 성공하고 재사용으로 세션을 폐기한다」와 같은 파일의 관련 사례.
- RED: N/A (사후 기록·확인 불가)
- GREEN: PASS (2026-10-02 현재 재검증)
- REFACTOR: N/A (과거 실행 로그 확인 불가)
- Result: PASS

## T-R5-1

- Requirement / AC: R5 / AC-R5-1
- Behavior: 해당 세션만 폐기하고 반복 호출은 성공한다. 알 수 없는 토큰도 204를 반환한다.
- Verification Type: INTEGRATION
- Test: `apps/api/src/auth/infrastructure/persistence/prisma-auth-session.repository.integration-spec.ts` — 「로그아웃은 해당 세션만 폐기하며 반복 호출해도 성공한다」와 같은 파일의 관련 사례.
- RED: N/A (사후 기록·확인 불가)
- GREEN: PASS (2026-10-02 현재 재검증)
- REFACTOR: N/A (과거 실행 로그 확인 불가)
- Result: PASS

## T-R6-1

- Requirement / AC: R6 / AC-R6-1
- Behavior: refresh 성공은 새 토큰 쌍, 유효하지 않은 토큰은 401, logout은 빈 204, DB 오류는 토큰 없는 500이다. 실제 AuthModule과 DB에서 로그인→갱신→재사용→세션 격리를 검증한다.
- Verification Type: E2E + INTEGRATION
- Test: `apps/api/test/session-lifecycle.e2e-spec.ts` — 「갱신 성공 시 회원 ID에 대한 새 토큰 쌍을 반환한다」와 같은 파일의 관련 사례.
- RED: N/A (사후 기록·확인 불가)
- GREEN: PASS (2026-10-02 현재 재검증)
- REFACTOR: N/A (과거 실행 로그 확인 불가)
- Result: PASS

추가 연결 근거: `apps/api/src/auth/auth.module.integration-spec.ts` — 「같은 소셜 회원에게 별도 세션과 토큰을 발급하고 DB에는 해시만 저장한다」는 로그인·갱신·재사용·다른 세션 유지·로그아웃까지 실제 DB에서 검증한다.

## Final Verification

2026-10-02 현재 재검증: pnpm test 106 PASS, pnpm test:e2e 38 PASS, pnpm test:integration 17 PASS. tsc --noEmit --incremental false, auth/users/database/test 범위 eslint, pnpm build 모두 exit 0. 관련 테스트 이름과 파일을 현재 코드에서 대조했다.
외부 제공자와 실제 앱의 수동 로그인 및 Eval은 N/A다. 이 문서는 새로운 Product Task의 RED/GREEN 기록을 대체하지 않는다.

## Task Identity 이관 검증 (2026-10-02)

MANUAL / PASS: 새 ULID·slug Directory와 YAML id 일치, ID 고유성, 네 문서·상태·참조 링크·과거 생성 날짜 보존을 확인했다.
RED/GREEN/REFACTOR: N/A (문서 전용 이관). 기존 제품 테스트 실행 결과는 보존했으며 이관만으로 재실행했다고 기록하지 않는다.
