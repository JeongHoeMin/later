# Verification

사후 baseline 기록이다. 아래 모든 Case의 RED와 REFACTOR는 **N/A (과거 실행 로그 확인 불가)**다.
현재 테스트가 PASS하더라도 과거 Test First를 증명하지 않는다. 코드를 되돌려 RED를 재현하지 않는다.

## T-R1-1

- Requirement / AC: R1 / AC-R1-1
- Behavior: 회원 ID로 15분 토큰을 발급하고 동일 시각 재발급도 다른 토큰을 반환한다.
- Verification Type: UNIT
- Test: `apps/api/src/auth/infrastructure/tokens/jwt-access-token.spec.ts` — 「같은 시각에 같은 회원에게 발급해도 서로 다른 토큰을 생성한다」와 같은 파일의 관련 사례.
- RED: N/A (사후 기록·확인 불가)
- GREEN: PASS (2026-10-02 현재 재검증)
- REFACTOR: N/A (과거 실행 로그 확인 불가)
- Result: PASS

## T-R2-1

- Requirement / AC: R2 / AC-R2-1
- Behavior: 서명 키·알고리즘·issuer·audience·typ·시간·필수 claim 검증에 실패하면 인증을 거부한다.
- Verification Type: UNIT
- Test: `apps/api/src/auth/infrastructure/tokens/jwt-access-token.spec.ts` — 「다른 키로 서명한 토큰은 거부한다」와 같은 파일의 관련 사례.
- RED: N/A (사후 기록·확인 불가)
- GREEN: PASS (2026-10-02 현재 재검증)
- REFACTOR: N/A (과거 실행 로그 확인 불가)
- Result: PASS

## T-R3-1

- Requirement / AC: R3 / AC-R3-1
- Behavior: 유효한 Bearer 토큰은 회원 ID를 전달하고 누락·잘못된 토큰은 공통 401로 응답한다.
- Verification Type: E2E
- Test: `apps/api/test/access-token.e2e-spec.ts` — 「발급된 토큰으로 보호 경로에 접근하면 인증된 회원을 전달한다」와 같은 파일의 관련 사례.
- RED: N/A (사후 기록·확인 불가)
- GREEN: PASS (2026-10-02 현재 재검증)
- REFACTOR: N/A (과거 실행 로그 확인 불가)
- Result: PASS

## T-R4-1

- Requirement / AC: R4 / AC-R4-1
- Behavior: 검증 시스템 오류를 인증 실패로 바꾸지 않고 500으로 전달한다.
- Verification Type: E2E
- Test: `apps/api/test/access-token.e2e-spec.ts` — 「검증 시스템 오류는 인증 실패로 숨기지 않고 500으로 전달한다」와 같은 파일의 관련 사례.
- RED: N/A (사후 기록·확인 불가)
- GREEN: PASS (2026-10-02 현재 재검증)
- REFACTOR: N/A (과거 실행 로그 확인 불가)
- Result: PASS

## Final Verification

2026-10-02 현재 재검증: pnpm test 106 PASS, pnpm test:e2e 38 PASS, pnpm test:integration 17 PASS. tsc --noEmit --incremental false, auth/users/database/test 범위 eslint, pnpm build 모두 exit 0. 관련 테스트 이름과 파일을 현재 코드에서 대조했다.
외부 제공자와 실제 앱의 수동 로그인 및 Eval은 N/A다. 이 문서는 새로운 Product Task의 RED/GREEN 기록을 대체하지 않는다.
