# Verification

외부 SDK는 jest 모듈 mock으로 경계에서 대체하고 매핑·상태 로직은 실제 구현을 사용한다.

## T-R1-1

- Requirement / AC: R1 / AC-R1-1, AC-R1-5, AC-R1-6
- Behavior: 카카오 SDK 성공·취소·실패·키 미설정 결과 매핑.
- Verification Type: UNIT
- Test: `apps/mobile/src/features/auth/social/__tests__/socialSignIn.test.ts` (kakao describe)
- RED: PASS — 최소 선언(`signInWith`가 Not implemented throw, `getAvailableProviders`가 [] 반환) 상태에서 `pnpm test`로 기대 동작 실패를 확인했다.
- GREEN: PASS
- REFACTOR: N/A (최소 구현이 이미 provider별 파일로 나뉘어 있어 추가 정리 불필요)
- Result: PASS
- Evidence: RED에서 Not implemented 또는 SocialLoginError 아님으로 실패. GREEN: `pnpm test -- socialSignIn` 21/21. 실행 테스트: `socialSignIn.test.ts` › kakao (5개 + 취소 메시지 3종).

## T-R1-2

- Requirement / AC: R1 / AC-R1-2, AC-R1-5, AC-R1-6
- Behavior: 구글 SDK success/cancelled 응답, idToken 누락, 오류 매핑.
- Verification Type: UNIT
- Test: 같은 파일 (google describe)
- RED: PASS — 최소 선언(`signInWith`가 Not implemented throw, `getAvailableProviders`가 [] 반환) 상태에서 `pnpm test`로 기대 동작 실패를 확인했다.
- GREEN: PASS
- REFACTOR: N/A (최소 구현이 이미 provider별 파일로 나뉘어 있어 추가 정리 불필요)
- Result: PASS
- Evidence: RED에서 Not implemented 또는 SocialLoginError 아님으로 실패. GREEN: `pnpm test -- socialSignIn` 21/21. 실행 테스트: `socialSignIn.test.ts` › google (5개).

## T-R1-3

- Requirement / AC: R1 / AC-R1-3, AC-R1-5, AC-R1-6
- Behavior: 네이버 SDK isSuccess/isCancel/실패 응답 매핑과 초기화.
- Verification Type: UNIT
- Test: 같은 파일 (naver describe)
- RED: PASS — 최소 선언(`signInWith`가 Not implemented throw, `getAvailableProviders`가 [] 반환) 상태에서 `pnpm test`로 기대 동작 실패를 확인했다.
- GREEN: PASS
- REFACTOR: N/A (최소 구현이 이미 provider별 파일로 나뉘어 있어 추가 정리 불필요)
- Result: PASS
- Evidence: RED에서 Not implemented 또는 SocialLoginError 아님으로 실패. GREEN: `pnpm test -- socialSignIn` 21/21. 실행 테스트: `socialSignIn.test.ts` › naver (4개).

## T-R1-4

- Requirement / AC: R1 / AC-R1-4, AC-R1-5, AC-R1-6
- Behavior: Apple 자격 증명 매핑, ERR_REQUEST_CANCELED 취소 처리, 토큰 누락 실패.
- Verification Type: UNIT
- Test: 같은 파일 (apple describe)
- RED: PASS — 최소 선언(`signInWith`가 Not implemented throw, `getAvailableProviders`가 [] 반환) 상태에서 `pnpm test`로 기대 동작 실패를 확인했다.
- GREEN: PASS
- REFACTOR: N/A (최소 구현이 이미 provider별 파일로 나뉘어 있어 추가 정리 불필요)
- Result: PASS
- Evidence: RED에서 Not implemented 또는 SocialLoginError 아님으로 실패. GREEN: `pnpm test -- socialSignIn` 21/21. 실행 테스트: `socialSignIn.test.ts` › apple (3개), getAvailableProviders (2개).

## T-R2-1

- Requirement / AC: R2 / AC-R2-1 ~ AC-R2-5
- Behavior: 플랫폼별 버튼 노출, 로딩·비활성, 성공 콜백, 취소 무시, 실패 메시지와 재시도.
- Verification Type: UNIT (컴포넌트, @testing-library/react-native)
- Test: `apps/mobile/src/features/auth/__tests__/LoginScreen.test.tsx`
- RED: PASS — 최소 선언(`signInWith`가 Not implemented throw, `getAvailableProviders`가 [] 반환) 상태에서 `pnpm test`로 기대 동작 실패를 확인했다.
- GREEN: PASS
- REFACTOR: N/A (최소 구현이 이미 provider별 파일로 나뉘어 있어 추가 정리 불필요)
- Result: PASS
- Evidence: RED에서 네이버 버튼 없음·onPress 미연결로 4개 실패. 테스트 설정 오류(RNTL v14의 async render/fireEvent)는 RED로 보지 않고 테스트를 수정했다. GREEN: `pnpm test` 4/4.

## T-R3-1

- Requirement / AC: R3 / AC-R3-1, AC-R3-2
- Behavior: 키 없이/있을 때 `expo config` 결과의 앱 ID와 plugin 구성.
- Verification Type: MANUAL (`npx expo config --type public`)
- RED: N/A (설정 검증)
- GREEN: PASS
- REFACTOR: N/A
- Result: PASS
- Evidence: 키 없이 `npx expo config --type public`를 실행하면 누락 경고만 나오고 bundleIdentifier·package가 `kr.pe.hoe.later`로, apple·google·build-properties plugin이 구성된다. 가짜 키로 `--type prebuild`를 실행하면 kakao(kakaoAppKey), naver(urlScheme), google(iosUrlScheme `com.googleusercontent.apps.123-abc`) plugin이 추가된다.

## Final Verification

- `pnpm test` (apps/mobile): PASS, 2 suites, 25 tests.
- `npx tsc --noEmit`: PASS. TS 6은 `types` 기본값이 `[]`이므로 tsconfig에 `types: ["jest"]`를 추가했다.
- `pnpm exec eslint apps/mobile`: 이번 변경 파일 PASS. 기존 오류 1건 `modules/later-share/src/LaterShareModule.web.ts` no-empty-object-type은 main에도 있는 것으로, 범위 밖이라 그대로 두었다.
- `npx expo-doctor`: 20/21. 남은 1건은 기존 expo 패치 버전 차이(57.0.25 → 57.0.26)이며, 업그레이드는 승인 범위가 아니다. jest와 @types/jest는 SDK 기준인 29로 맞췄다.
- `expo prebuild --platform android --clean` (가짜 키): PASS. AuthCodeHandlerActivity(kakao scheme), `kakao_app_key`, applicationId `kr.pe.hoe.later` 생성을 확인했다.
- Android `gradlew assembleDebug`: BLOCKED. Agent 실행 환경에서 Gradle daemon이 `java.io.IOException: Unable to establish loopback connection`으로 시작하지 못했다(샌드박스 해제와 jdk.net.unixdomain.tmpdir 지정 후에도 동일). 코드 문제가 아닌 환경 문제다.
- iOS 빌드: N/A (Windows 환경).
- 실기기 로그인: BLOCKED. 실제 앱 키와 각 콘솔 등록이 필요하다.
