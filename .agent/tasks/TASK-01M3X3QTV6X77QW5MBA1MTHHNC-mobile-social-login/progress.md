# Progress

## Current State

2026-10-02 사용자 승인: 네이티브 SDK 방식, 카카오·구글·네이버 + Apple 구현, 키는 환경변수 자리만, 앱 ID `kr.pe.hoe.later`.
서버 API 연동은 문서 확정 후 진행한다. R1~R3 구현 완료, 테스트 GREEN. Android 네이티브 빌드 확인만 남았다(환경 제약).

## Task Identity 이관

- 이전 ID: `TASK-002` (`.agent/tasks/TASK-002/`, 미커밋) → 새 ID: `TASK-01M3X3QTV6X77QW5MBA1MTHHNC` (`TASK-01M3X3QTV6X77QW5MBA1MTHHNC-mobile-social-login/`).
- 이유: 2026-10-02 main에 반영된 [Task Identity 지침](../../task-identity.md)에 맞추라는 사용자 요청. 요구사항·검증 이력은 그대로 보존했다.
- created_at은 생성 시각을 기록하지 않아 날짜(`2026-10-02`)만 보존한다(시각 미상).

## Completed

- SDK·테스트 도구(jest-expo, RNTL 14, test-renderer) 설치.
- T-R1~R2 RED → GREEN, T-R3 설정 확인. 상세는 verification.md.

## In Progress

Android 네이티브 빌드 확인.

## Remaining

사용자 환경에서 Android 빌드를 확인한 뒤 커밋한다. 실기기 로그인 확인에는 실제 키가 필요하다.

## Decisions

- Decision: 네이티브 SDK(@react-native-seoul/kakao-login, @react-native-seoul/naver-login, @react-native-google-signin/google-signin, expo-apple-authentication). Reason: 카카오톡 앱 로그인을 지원하고 서버가 검증할 제공자 토큰을 직접 받는다. Alternatives: expo-auth-session은 네이버 code 교환에 서버가 필요하다.
- Decision: Apple은 iOS에서만 노출. Reason: Android Apple 로그인은 웹 Service ID 흐름이 필요해 범위 밖이다.
- Decision: pnpm allowBuilds에서 dooboolab-welcome, @parcel/watcher, unrs-resolver 빌드 스크립트를 false로 설정. Reason: 안내 출력 또는 prebuilt 바이너리가 있어 설치 스크립트가 필요 없다.

- Decision: 키 의존 plugin은 app.config.ts에서 env가 있을 때만 추가하고, 고정 설정은 app.json에 둔다. Reason: 키가 없어도 다른 작업의 start·prebuild를 막지 않는다.
- Decision: 카카오 취소는 오류 메시지(`cancel`, `access_denied`)로 판별한다. Reason: 라이브러리가 모든 오류를 같은 코드 `RNKakaoLogins`로 reject한다.
- Decision: jest 29 사용. Reason: Expo SDK 57이 요구하는 버전(expo-doctor).

## Issues / Blocker

- Android Gradle 빌드: Agent 환경에서 `Unable to establish loopback connection`. Required To Resume: 사용자 터미널에서 `apps/mobile/android`의 `./gradlew assembleDebug` 또는 루트 `pnpm dev:android`가 성공하는지 확인.
- 로컬 `android/`는 가짜 키로 prebuild된 상태다. 실제 키를 `.env.local`에 넣은 뒤 `pnpm prebuild:android -- --clean`을 다시 실행해야 한다.

## 후속 Task에서 바뀐 내용

- 2026-10-02 서버 계약 확정에 따라 [TASK-01M3XFK681BHXV7FYZDXFJ4K3T](../TASK-01M3XFK681BHXV7FYZDXFJ4K3T-mobile-server-social-login/task.yaml)에서 네이버 네이티브 SDK·Client Secret·URL Scheme(R1 AC-R1-3, R3 일부)을 서버 브리지 흐름으로 대체했다. Apple 이름 전달(AC-R1-4)도 서버 계약에 없어 제거했다.

## Discovered Requirements

- DISC-001 / NEEDS_CONFIRMATION: 서버도 Apple 로그인(identityToken 검증)을 지원해야 한다. 사용자가 서버 측에 전달하기로 함.

## Failed Attempts

- Gradle 빌드: 샌드박스 해제, JAVA_TOOL_OPTIONS `-Djdk.net.unixdomain.tmpdir` 지정, 사용자 터미널 탭(셸 통합 로드 실패) 모두 실패.

## 후속 제안

백엔드 로그인 API 문서가 확정되면 별도 Task로 서버 로그인 연동, 토큰 저장(secure store), 자동 로그인을 진행한다.

## Next Action

사용자 환경에서 Android 빌드(`pnpm dev:android`)를 확인한다. 성공하면 verification.md의 Gradle 항목을 PASS로 갱신하고, 이번 Task 파일만 stage해 `feat(mobile): 카카오·구글·네이버·Apple 소셜 로그인 SDK 연동`으로 커밋한다(커밋은 사용자 승인 후).
