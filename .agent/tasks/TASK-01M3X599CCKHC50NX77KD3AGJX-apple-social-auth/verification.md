# Verification

| Test   | AC               | Behavior                          | Type                     | RED  | GREEN | Result |
| ------ | ---------------- | --------------------------------- | ------------------------ | ---- | ----- | ------ |
| T-R1-1 | AC-R1-1          | 무작위 생성·해시 저장·5분 만료    | UNIT + E2E               | PASS | PASS  | PASS   |
| T-R1-2 | AC-R1-2          | 불일치·만료·재사용·동시 소비 거부 | UNIT + INTEGRATION + E2E | PASS | PASS  | PASS   |
| T-R2-1 | AC-R2-1          | 실제 RSA 서명·필수 claims         | UNIT + E2E               | PASS | PASS  | PASS   |
| T-R2-2 | AC-R2-2          | JWKS 고정 URL·캐시·교체·장애      | UNIT + E2E               | PASS | PASS  | PASS   |
| T-R2-3 | AC-R2-3          | 설정·DI                           | UNIT + E2E               | PASS | PASS  | PASS   |
| T-R3-1 | AC-R3-1, AC-R3-2 | 입력·신규/기존·DB·회귀            | UNIT + E2E + INTEGRATION | PASS | PASS  | PASS   |
| T-R4-1 | AC-R4-1          | 문서 계약·링크·포맷               | MANUAL                   | N/A  | N/A   | PASS   |

외부 HTTP만 대체하고 실제 jose·어댑터·usecase·HTTP 실행. later_test DB에서 자기 행만 정리. REFACTOR 미수행은 N/A.

## Final Verification

PASS: Unit 230, E2E 72, Integration 23, tsc, 변경 TS lint, build, 문서·포맷·diff·fresh reviewer. 실제 Apple 로그인은 미실행이며 모바일/콘솔 연동 후 검증한다.

## 공식 근거

[Apple 사용자 검증](https://developer.apple.com/documentation/signinwithapple/verifying-a-user), [Apple 인증](https://developer.apple.com/documentation/signinwithapple/authenticating-users-with-sign-in-with-apple), [Apple JWKS](https://appleid.apple.com/auth/keys), [jose](https://github.com/panva/jose/blob/main/docs/jwks/remote/functions/createRemoteJWKSet.md).
2026-10-02 실제 공식 공개 키의 alg는 RS256이다. 사용자 검증 문서 E256 표기와 혼동하지 않고 RS256만 허용한다.

## 실제 테스트 연결과 결과

- T-R1-1: application/start-apple-login.use-case.spec.ts의 무작위 생성·해시만 5분 저장, 저장 실패 테스트; apple-login.e2e-spec.ts 시작 응답·입력 거부.
- T-R1-2: prisma-apple-login-attempt.repository.integration-spec.ts의 한 번 소비·다른 nonce/누락·정확한 만료 경계·동시 8개 요청; apple-login.e2e-spec.ts의 불일치/만료/누락·재사용 401.
- T-R2-1/T-R2-2: infrastructure/apple/apple-auth-provider.spec.ts의 실제 RSA claims·서명·alg·키 없음·캐시·교체·HTTP/통신/비정상 JWKS·조회 중 만료 검증.
- T-R2-3: auth.module.spec.ts의 Apple 설정 누락과 어댑터의 설정 목록 검증; apple-auth.module.integration-spec.ts의 실제 DI.
- T-R3-1: social-login-request.pipe.spec.ts의 Apple 입력 보존과 잘못된 입력, apple-login.e2e-spec.ts의 신규/기존 회원·서비스 JWT·401/503/400, 실제 저장소와 module integration의 Apple 회원·세션.
- T-R4-1: docs/social-login-process.md, HTTP README, .env.example과 실제 코드·공식 계약 대조.

RED: 시작·어댑터 최소 선언 후 33개 기대 실패. HTTP 입력 보존과 모듈 설정 누락 2개 기대 실패(72개 회귀 PASS). DB 저장소 미구현 4개 기대 실패, schema 준비 뒤 Apple 회원 저장 1개는 PASS로 구분한다. E2E 미등록 10개 기대 실패와 3개 입력 회귀 PASS. 조회 중 토큰 만료 1개 재현 RED 확인.
GREEN: 위 구현·보완 후 관련 Unit 76 PASS, 어댑터 만료 보완 뒤 33 PASS, E2E 13 PASS, DB 저장소 5 PASS. 추가 실제 DI 통합 검증 포함 전체 Unit 230/23파일, E2E 72/8파일, Integration 23/6파일 PASS.
REFACTOR: N/A, 별도 동작 리팩터링 없음. 포맷과 기존 테스트 환경에 APPLE_CLIENT_IDS 추가만 수행.
타입 검사·변경 TS lint·build PASS. 개발 later_dev·테스트 later_test에 additive migration deploy, generated client 재생성 PASS. 실제 Apple 콘솔·모바일 SDK·사용자 로그인은 미실행.

Fresh reviewer: 수정 필요 finding 없음. 리뷰어 자체 실행은 spawn EPERM으로 시작되지 않아 PASS로 기록하지 않는다. 부모의 전체 Suite 실행 결과는 별도 위 기록과 같다. 문서 변경 TDD N/A이며 실제 코드/공식 계약·로컬 링크·YAML/ID·포맷·diff로 확인했다.
