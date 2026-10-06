# Verification

외부 SDK·인증 브라우저·secure store·fetch는 경계에서 대체하고 요청 조립·시도 검증·상태 처리는 실제 구현을 사용한다.

## T-R1-1

- Requirement / AC: R1 / AC-R1-1 ~ AC-R1-3
- Behavior: base URL·JSON 헤더·204 처리, 오류 envelope·네트워크 오류 변환.
- Verification Type: UNIT
- Test: `apps/mobile/src/shared/api/__tests__/apiClient.test.ts`
- RED: PASS — 최소 선언(apiRequest·loginWithProvider·logout·saveSessionTokens가 Not implemented throw) 상태에서 `pnpm test` 실행 시 39개가 기대 동작 부재로 실패했다. LoginScreen suite의 최초 실패(RNGoogleSignin 네이티브 모듈 import)는 환경 오류로 보고 화면 import 경로를 고친 뒤 기대 동작 RED(세션 미전달·오류 문구 없음)를 다시 확인했다.
- GREEN: PASS
- REFACTOR: N/A (최소 구현이 제공자별 함수로 분리되어 추가 정리 불필요)
- Result: PASS
- Evidence: `apiClient.test.ts` 7/7 PASS.

## T-R2-1

- Requirement / AC: R2, R5 / AC-R2-1, AC-R2-2, AC-R5-1
- Behavior: 카카오·구글 credential 전송 본문, 취소 시 API 미호출, 성공 시 토큰 저장.
- Verification Type: UNIT
- Test: `apps/mobile/src/features/auth/__tests__/loginWithProvider.test.ts`
- RED: PASS — 최소 선언(apiRequest·loginWithProvider·logout·saveSessionTokens가 Not implemented throw) 상태에서 `pnpm test` 실행 시 39개가 기대 동작 부재로 실패했다. LoginScreen suite의 최초 실패(RNGoogleSignin 네이티브 모듈 import)는 환경 오류로 보고 화면 import 경로를 고친 뒤 기대 동작 RED(세션 미전달·오류 문구 없음)를 다시 확인했다.
- GREEN: PASS
- REFACTOR: N/A (최소 구현이 제공자별 함수로 분리되어 추가 정리 불필요)
- Result: PASS
- Evidence: `loginWithProvider.test.ts` kakao·google 8개 PASS.

## T-R3-1

- Requirement / AC: R3 / AC-R3-1 ~ AC-R3-3
- Behavior: start → 원본 nonce 전달 → loginAttemptId 포함 로그인, 취소·만료 폐기.
- Verification Type: UNIT
- Test: 같은 파일 (apple describe) 및 `social/__tests__/socialSignIn.test.ts` (nonce 전달)
- RED: PASS — 최소 선언(apiRequest·loginWithProvider·logout·saveSessionTokens가 Not implemented throw) 상태에서 `pnpm test` 실행 시 39개가 기대 동작 부재로 실패했다. LoginScreen suite의 최초 실패(RNGoogleSignin 네이티브 모듈 import)는 환경 오류로 보고 화면 import 경로를 고친 뒤 기대 동작 RED(세션 미전달·오류 문구 없음)를 다시 확인했다.
- GREEN: PASS
- REFACTOR: N/A (최소 구현이 제공자별 함수로 분리되어 추가 정리 불필요)
- Result: PASS
- Evidence: `loginWithProvider.test.ts` apple 4개, `socialSignIn.test.ts` apple 3개 PASS.

## T-R4-1

- Requirement / AC: R4 / AC-R4-1 ~ AC-R4-3
- Behavior: authorizationUrl·반환 URL 그대로 열기, ID 일치·만료 전에만 공통 로그인(provider=naver), 취소·불일치·누락·만료 차단.
- Verification Type: UNIT
- Test: 같은 파일 (naver describe)
- RED: PASS — 최소 선언(apiRequest·loginWithProvider·logout·saveSessionTokens가 Not implemented throw) 상태에서 `pnpm test` 실행 시 39개가 기대 동작 부재로 실패했다. LoginScreen suite의 최초 실패(RNGoogleSignin 네이티브 모듈 import)는 환경 오류로 보고 화면 import 경로를 고친 뒤 기대 동작 RED(세션 미전달·오류 문구 없음)를 다시 확인했다.
- GREEN: PASS
- REFACTOR: N/A (최소 구현이 제공자별 함수로 분리되어 추가 정리 불필요)
- Result: PASS
- Evidence: `loginWithProvider.test.ts` naver 8개 PASS. 계약 변경(서버 `bef5200`, 네이버 최종 로그인을 `POST /auth/social/login`으로 통합) 재작업: 테스트를 새 경로·본문으로 바꾼 뒤 RED(2개 실패, 기존 코드가 `/auth/social/naver/complete` 호출) → 구현 수정 → GREEN 55/55.

## T-R5-1

- Requirement / AC: R5 / AC-R5-2
- Behavior: 로그아웃 API 호출 후 로컬 삭제, API 실패에도 로컬 삭제.
- Verification Type: UNIT
- Test: `apps/mobile/src/features/auth/session/__tests__/session.test.ts`
- RED: PASS — 최소 선언(apiRequest·loginWithProvider·logout·saveSessionTokens가 Not implemented throw) 상태에서 `pnpm test` 실행 시 39개가 기대 동작 부재로 실패했다. LoginScreen suite의 최초 실패(RNGoogleSignin 네이티브 모듈 import)는 환경 오류로 보고 화면 import 경로를 고친 뒤 기대 동작 RED(세션 미전달·오류 문구 없음)를 다시 확인했다.
- GREEN: PASS
- REFACTOR: N/A (최소 구현이 제공자별 함수로 분리되어 추가 정리 불필요)
- Result: PASS
- Evidence: `session.test.ts` 4/4 PASS.

## T-R6-1

- Requirement / AC: R6 / AC-R6-1
- Behavior: 오류 종류별 메시지, 진행 중 다른 버튼 비활성.
- Verification Type: UNIT (컴포넌트)
- Test: `apps/mobile/src/features/auth/__tests__/LoginScreen.test.tsx`
- RED: PASS — 최소 선언(apiRequest·loginWithProvider·logout·saveSessionTokens가 Not implemented throw) 상태에서 `pnpm test` 실행 시 39개가 기대 동작 부재로 실패했다. LoginScreen suite의 최초 실패(RNGoogleSignin 네이티브 모듈 import)는 환경 오류로 보고 화면 import 경로를 고친 뒤 기대 동작 RED(세션 미전달·오류 문구 없음)를 다시 확인했다.
- GREEN: PASS
- REFACTOR: N/A (최소 구현이 제공자별 함수로 분리되어 추가 정리 불필요)
- Result: PASS
- Evidence: `LoginScreen.test.tsx` 7/7 PASS.

## T-R4-2 / T-R6-2

- Requirement / AC: R4, R6 / AC-R4-4, AC-R6-2, 실제 서버 로그인
- Verification Type: MANUAL (에뮬레이터 + `http://19.19.20.49:3000`)
- RED: N/A
- GREEN: BLOCKED
- REFACTOR: N/A
- Result: BLOCKED
- Evidence: AC-R4-4는 확인했다. naver-login 패키지·plugin·env를 제거했고, `expo prebuild --clean` 결과 매니페스트에 `kr.pe.hoe.later` 스킴만 있고 naver 설정은 없다. 실제 서버 로그인은 서버가 응답하지 않고(HTTP 000) Agent 환경에서 Gradle 빌드가 불가해 미실행.

## Final Verification

- `pnpm test`: PASS, 5 suites, 55 tests.
- `npx tsc --noEmit`: PASS.
- `pnpm exec eslint apps/mobile`: 이번 변경 PASS. 기존 오류 1건(`LaterShareModule.web.ts`)은 범위 밖이라 그대로 두었다.
- `npx expo-doctor`: 20/21. 남은 1건은 기존 expo 패치 버전 차이다.
- `expo config --type prebuild`: scheme `kr.pe.hoe.later`, kakao·google·secure-store·web-browser plugin, naver 없음.
- `expo prebuild --platform android --clean`: PASS.
- 실제 서버 대상 수동 로그인: BLOCKED (서버 미응답, Gradle 환경 제약).
