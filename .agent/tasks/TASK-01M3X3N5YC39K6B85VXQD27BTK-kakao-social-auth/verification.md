# Verification

| Test   | AC               | Behavior / 실제 테스트                                                                                        | Type       | RED  | GREEN | REFACTOR | Result |
| ------ | ---------------- | ------------------------------------------------------------------------------------------------------------- | ---------- | ---- | ----- | -------- | ------ |
| T-R1-1 | AC-R1-1, AC-R1-2 | kakao-auth-provider.spec.ts: 검증된 회원번호·고정 API·Bearer·다른 앱·만료·토큰 거부                           | UNIT       | PASS | PASS  | N/A      | PASS   |
| T-R1-2 | AC-R1-3          | kakao-auth-provider.spec.ts: 잘못된 응답·통신·5초 AbortSignal·redirect 제한·장애 분리                         | UNIT       | PASS | PASS  | N/A      | PASS   |
| T-R2-1 | AC-R2-1, AC-R2-2 | auth.module.spec.ts: KAKAO_APP_ID 구성 거부·카카오 회원 연결·구글 회귀                                        | UNIT       | PASS | PASS  | N/A      | PASS   |
| T-R3-1 | AC-R3-1, AC-R3-2 | social-login-request.pipe.spec.ts, kakao-login.e2e-spec.ts: provider 보존·가입/로그인·서비스 토큰·400/401/503 | UNIT + E2E | PASS | PASS  | N/A      | PASS   |

## 실제 테스트 연결

모든 경로는 저장소 루트 기준이다.

- `apps/api/src/auth/infrastructure/kakao/kakao-auth-provider.spec.ts`: 「검증된 토큰 정보의 회원번호를 subject로 반환한다」, 「5초 제한의 AbortSignal을 HTTP 요청에 전달한다」 및 매개변수별 오류·설정 사례.
- `apps/api/src/auth/auth.module.spec.ts`: 「카카오 인증 결과로 회원을 연결하고 구글 어댑터를 호출하지 않는다」 및 KAKAO_APP_ID 매개변수 사례.
- `apps/api/src/auth/presentation/http/social-login-request.pipe.spec.ts`: 「카카오 Access Token과 provider를 그대로 반환한다」와 기존 잘못된 요청 검증.
- `apps/api/test/kakao-login.e2e-spec.ts`: 「%s 카카오 회원에게 서비스 토큰 쌍을 반환한다」, 「카카오 장애 또는 응답 오류 %i는 공통 503으로 처리한다」 등 13개 사례. HTTP 경계에서 fetch만 대체하고 실제 KakaoAuthProvider·AuthModule·JWT 로직을 사용한다.

## RED 근거

- 어댑터+Pipe: `pnpm exec vitest run src/auth/infrastructure/kakao/kakao-auth-provider.spec.ts src/auth/presentation/http/social-login-request.pipe.spec.ts` — 어댑터 39개는 미구현 동작, Pipe 1개는 카카오 거부로 실패. 기존 Pipe 16개는 PASS. 비동기 assertion의 초기 처리 문제를 수정한 두 번째 실행은 unhandled error 없이 기대 Behavior 실패를 확인했다.
- DI: `pnpm exec vitest run src/auth/auth.module.spec.ts` — 새 설정 거부 5개와 카카오 DI 연결 1개 실패, 기존 5개 PASS. 이유는 잘못된 앱 설정을 허용하고 카카오가 UnsupportedSocialProviderError로 거부되었기 때문이다.
- HTTP: `pnpm exec vitest run --config vitest.config.e2e.ts test/kakao-login.e2e-spec.ts` — 신규 동작 10개는 기대 200/401/503/500 대신 400으로 실패, 기존 요청 검증 사례 3개 PASS.
- 원래 카카오를 거부하던 테스트는 지원 범위 확장에 맞춰 빈 카카오 credential 또는 미지원 naver를 거부하도록 갱신했다. 실패 테스트를 삭제해 해결하지 않았다.

## GREEN / REFACTOR

어댑터+Pipe 56개, AuthModule 11개, 카카오 E2E 13개가 각각 PASS했다.
REFACTOR N/A: 별도 Behavior 보존 Refactoring은 수행하지 않았다. 포맷 정리 후 전체 Suite로 다시 확인했다.

## Final Verification

2026-10-02 `apps/api`에서:

- `pnpm test`: 152 PASS.
- `pnpm test:e2e`: 51 PASS.
- `pnpm test:integration`: 17 PASS, later_test DB만 사용.
- `pnpm exec tsc --noEmit --incremental false`: exit 0.
- 변경한 TS 파일 ESLint: exit 0.
- `pnpm build`: exit 0.
- 별도 코드 검토: 중요한 결함 없음. 실제 카카오 서버·토큰과 네이티브 fetch의 실제 5초 경과는 실행하지 않았다. timeout 설정 및 AbortSignal 전파·실패 처리는 자동화 테스트에서 확인했다.
- 문서·diff: YAML·완료 상태·필수 section·R/AC/Test 연결·상대 링크 검증과 Prettier --check 통과. git diff --cached --check를 커밋 전에 확인한다.

모바일/shared 변경·DB 스키마 변경·LLM 기능 없음. 해당 앱 검증·migration·Eval은 N/A다.
실제 카카오 서버·모바일 수동 로그인은 N/A이며 성공했다고 기록하지 않는다. `.env`의 실제 KAKAO_APP_ID는 사용자가 설정해야 한다.
공식 계약: [카카오 토큰 정보 API](https://developers.kakao.com/docs/ko/kakaologin/rest-api#access-token-info) (2026-10-02 확인).

## Task Identity 이관 검증 (2026-10-02)

MANUAL / PASS: 새 ULID·slug Directory와 YAML id 일치, ID 고유성, 네 문서·상태·참조 링크·과거 생성 날짜 보존을 확인했다.
RED/GREEN/REFACTOR: N/A (문서 전용 이관). 기존 제품 테스트 실행 결과는 보존했으며 이관만으로 재실행했다고 기록하지 않는다.
