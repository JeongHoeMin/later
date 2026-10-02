# Verification

이 문서는 카카오·네이버 추가 전 사후 기록 baseline이다. 아래의 현재 상태·검증 수치·미구현 설명은 당시 기록 기준이며 이번 문서 이관의 실행 결과와 구분한다. 최신 제공자 상태는 [네이버 Task](../TASK-01M3X3N5YE122YB2CP9Z2642J7-naver-social-auth/task.yaml)를 참고한다.

사후 baseline 기록이다. 아래 모든 Case의 RED와 REFACTOR는 **N/A (과거 실행 로그 확인 불가)**다.
현재 테스트가 PASS하더라도 과거 Test First를 증명하지 않는다. 코드를 되돌려 RED를 재현하지 않는다.

## T-R1-1

- Requirement / AC: R1 / AC-R1-1
- Behavior: 인증 실패 시 회원 조회·생성을 실행하지 않는다.
- Verification Type: UNIT
- Test: `apps/api/src/auth/application/social-login.use-case.spec.ts` — 「소셜 인증에 실패하면 회원 조회와 생성을 실행하지 않는다」와 같은 파일의 관련 사례.
- RED: N/A (사후 기록·확인 불가)
- GREEN: PASS (2026-10-02 현재 재검증)
- REFACTOR: N/A (과거 실행 로그 확인 불가)
- Result: PASS

## T-R2-1

- Requirement / AC: R2 / AC-R2-1
- Behavior: 유효한 토큰의 sub를 사용하고 다른 키로 서명한 토큰은 거부한다. 잘못된 audience·issuer·만료 등은 같은 suite의 매개변수 사례로 검증한다.
- Verification Type: UNIT
- Test: `apps/api/src/auth/infrastructure/google/google-auth-provider.spec.ts` — 「다른 개인키로 서명한 토큰은 거부한다」와 같은 파일의 관련 사례.
- RED: N/A (사후 기록·확인 불가)
- GREEN: PASS (2026-10-02 현재 재검증)
- REFACTOR: N/A (과거 실행 로그 확인 불가)
- Result: PASS

## T-R3-1

- Requirement / AC: R3 / AC-R3-1
- Behavior: 신규와 기존 회원 모두 200으로 응답하며 현재는 google provider만 허용한다.
- Verification Type: E2E
- Test: `apps/api/test/social-login.e2e-spec.ts` — 「신규 회원도 같은 경로에서 생성하고 200을 반환한다」와 같은 파일의 관련 사례.
- RED: N/A (사후 기록·확인 불가)
- GREEN: PASS (2026-10-02 현재 재검증)
- REFACTOR: N/A (과거 실행 로그 확인 불가)
- Result: PASS

## T-R4-1

- Requirement / AC: R4 / AC-R4-1
- Behavior: 잘못된 본문·추가 필드는 400, 외부 인증 실패는 401, DB 오류는 토큰 없는 500으로 응답한다.
- Verification Type: E2E
- Test: `apps/api/test/social-login.e2e-spec.ts` — 「인증 실패는 공통 401 응답으로 변환한다」와 같은 파일의 관련 사례.
- RED: N/A (사후 기록·확인 불가)
- GREEN: PASS (2026-10-02 현재 재검증)
- REFACTOR: N/A (과거 실행 로그 확인 불가)
- Result: PASS

## Final Verification

2026-10-02 현재 재검증: pnpm test 106 PASS, pnpm test:e2e 38 PASS, pnpm test:integration 17 PASS. tsc --noEmit --incremental false, auth/users/database/test 범위 eslint, pnpm build 모두 exit 0. 관련 테스트 이름과 파일을 현재 코드에서 대조했다.
외부 제공자와 실제 앱의 수동 로그인 및 Eval은 N/A다. 이 문서는 새로운 Product Task의 RED/GREEN 기록을 대체하지 않는다.

## Task Identity 이관 검증 (2026-10-02)

MANUAL / PASS: 새 ULID·slug Directory와 YAML id 일치, ID 고유성, 네 문서·상태·참조 링크·과거 생성 날짜 보존을 확인했다.
RED/GREEN/REFACTOR: N/A (문서 전용 이관). 기존 제품 테스트 실행 결과는 보존했으며 이관만으로 재실행했다고 기록하지 않는다.
