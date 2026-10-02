# Verification

구현 전 초안에서 공식 계약과 사용자 승인에 따라 네이버 code/state 교환 사례를 확정했다.

| Test   | AC               | Behavior                                                                                   | Type       | RED  | GREEN | REFACTOR | Result |
| ------ | ---------------- | ------------------------------------------------------------------------------------------ | ---------- | ---- | ----- | -------- | ------ |
| T-R1-1 | AC-R1-1, AC-R1-2 | 우리 앱의 자격증명으로 코드를 교환하고 프로필의 문자열 ID만 반환; 교환 인증 오류·만료 거부 | UNIT + E2E | PASS | PASS  | N/A      | PASS   |
| T-R1-2 | AC-R1-3          | 비정상 응답·외부 장애·통신 실패 분류, 요청 timeout signal·redirect 거부, 원문 비노출       | UNIT + E2E | PASS | PASS  | N/A      | PASS   |
| T-R2-1 | AC-R2-1, AC-R2-2 | 설정 검증·DI와 실제 어댑터 회원 연결, 구글·카카오 회귀                                     | UNIT + E2E | PASS | PASS  | N/A      | PASS   |
| T-R3-1 | AC-R3-1, AC-R3-2 | provider/code/state 보존, 신규·기존 서비스 JWT 발급, 입력·인증·장애 오류와 저장 차단       | UNIT + E2E | PASS | PASS  | N/A      | PASS   |
| T-R4-1 | AC-R4-1, AC-R4-2 | 모바일 참고 문서의 단계·책임·설정·입력·제한 사항과 실제 코드·공식 계약 일치                | MANUAL     | N/A  | N/A   | N/A      | PASS   |

## 실제 테스트 연결

- apps/api/src/auth/infrastructure/naver/naver-auth-provider.spec.ts: T-R1-1 `우리 앱으로 인가 코드를 교환하고 프로필의 subject만 반환한다`, `코드 교환 인증 오류 %s는 인증 실패다`, `만료된 교환 토큰 %j는 거부한다`; T-R1-2 `교환 장애 또는 응답 오류 %i %j는 외부 장애다`, `프로필 오류 %i %j를 분류한다`, `%s 통신 실패에 원문을 노출하지 않는다`; T-R2-1 `누락된 앱 설정으로 구성할 수 없다`.
- apps/api/src/auth/auth.module.spec.ts: T-R2-1 `네이버 설정 %s 누락은 모듈 구성을 거부한다`, 기존 구글·카카오 연결 테스트.
- apps/api/src/auth/presentation/http/social-login-request.pipe.spec.ts: T-R3-1 `네이버 인가 코드와 state를 보존한다`, `제공자별 잘못된 state 또는 추가 필드를 거부한다`.
- apps/api/test/naver-login.e2e-spec.ts: T-R2-1/T-R3-1 `%s 회원에게 서비스 토큰을 발급한다`, `외부 실패 %i %j는 저장 없이 공통 오류로 처리한다`, `잘못된 입력은 외부 호출 전에 400이다`.
- docs/social-login-process.md 및 HTTP README: T-R4-1 실제 구현·공식 문서 대조와 로컬 링크 확인.

외부 HTTP 경계만 대체하고 실제 어댑터·유스케이스·Nest HTTP·JWT 로직을 검증한다. 기존 DB 통합 Suite로 저장·동시성 회귀를 확인한다.

## Final Verification

2026-10-02 실행 결과:

- 어댑터의 테스트 실행용 최소 선언 후 29/29 기대 실패 RED 확인. HTTP pipe의 네이버 입력 보존 1개 기대 실패 확인.
- AuthModule 설정 2개는 잘못된 설정으로 모듈이 성공해 기대 실패. 실제 네이버 E2E 정상·오류 5개는 어댑터 미등록으로 500이 발생해 기대 실패. 입력 3개는 이미 pipe에서 보호돼 회귀 PASS로 구분한다.
- GREEN: 어댑터·pipe·module 65개, 네이버 E2E 8개 PASS.
- pnpm test: 21 files / 189 tests PASS. 첫 전체 실행의 기존 mock 인자 불일치 1개는 계약 기대 수정 후 재실행 PASS.
- pnpm test:e2e: 7 files / 59 tests PASS.
- pnpm test:integration: later_test의 4 files / 17 tests PASS. 기존 테스트의 대상 DB 검사와 테스트 소유 데이터 정리를 유지했다.
- pnpm exec tsc --noEmit --incremental false: PASS.
- 변경 TypeScript 파일의 pnpm exec eslint: PASS.
- pnpm build: PASS.
- REFACTOR: N/A, 별도 동작 리팩터링 없음. 필요한 포맷·기존 테스트 설정·계약 기대 갱신만 수행.
- 기존 vite-tsconfig-paths 중복 안내는 경고이며 테스트 실패가 아니다. 최초 sandbox spawn EPERM은 환경 시작 오류이고 RED에서 제외한다.
- 코드 리뷰: 승인된 범위에서 actionable finding 없음.
- 문서 로컬 링크·Prettier(YAML 포함)·git diff --check: PASS. Windows 줄바꿈 안내는 실패가 아니다.

네이버 token response의 expires_in은 공식 표의 숫자와 예시의 문자열을 모두 허용한다.
교환의 문서화된 unauthorized_client/invalid_request 및 invalid_grant/access_denied 인증 오류는 401로 변환하며, 알 수 없는 오류·서버 장애는 503이다.
timeout signal 제공과 오류 분류는 자동 검증하지만 실제 네이버의 지연·장애를 발생시킨 검증은 아니다.
실제 네이버 앱·다른 앱 코드·만료·재사용·모바일 로그인/state/nonce 보호는 미실행이다. 앱 귀속은 공식 서버 코드 교환 계약과 앱 자격증명 전송 테스트를 근거로 한다.
R4 문서는 제품 동작을 바꾸지 않으므로 TDD 예외이며 계약·링크·포맷·diff로 검증한다.

## 확인할 공식 문서

[네이버 로그인 API](https://developers.naver.com/docs/login/api/api.md), [네이버 프로필 API](https://developers.naver.com/docs/login/profile/profile.md)를 2026-10-02 확인했다.
