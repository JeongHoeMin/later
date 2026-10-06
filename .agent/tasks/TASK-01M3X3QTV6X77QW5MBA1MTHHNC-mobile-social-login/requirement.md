# Requirement

## Background / Goal

로그인 화면은 디자인만 있고 버튼을 누르면 즉시 로그인된 것으로 처리된다.
카카오·구글·네이버·Apple 네이티브 SDK로 실제 소셜 로그인을 수행하고, 서버가 검증할 제공자 토큰을 얻는다.
백엔드 API 문서가 아직 없으므로 우리 서버 호출은 경계 함수로만 두고 추후 Task에서 구현한다.

## R1 - 제공자별 소셜 로그인으로 서버 검증용 자격 증명을 얻는다

### Acceptance Criteria

- AC-R1-1: 카카오 로그인 성공 시 `{ provider: 'kakao', accessToken, idToken? }`를 반환한다.
- AC-R1-2: 구글 로그인 성공 시 `{ provider: 'google', idToken }`를 반환한다. idToken이 없으면 실패로 처리한다.
- AC-R1-3: 네이버 로그인 성공 시 `{ provider: 'naver', accessToken }`를 반환한다.
- AC-R1-4: Apple 로그인 성공 시 `{ provider: 'apple', identityToken, authorizationCode, givenName, familyName }`를 반환한다. 이름은 최초 동의 때만 내려오므로 함께 전달한다. identityToken이 없으면 실패로 처리한다.
- AC-R1-5: 사용자가 로그인을 취소하면 오류가 아닌 `cancelled` 결과를 반환한다.
- AC-R1-6: SDK 실패 또는 앱 키 미설정 시 제공자 정보가 담긴 `SocialLoginError`를 던진다.

## R2 - 로그인 화면이 실제 로그인 흐름과 상태를 표시한다

### Acceptance Criteria

- AC-R2-1: 화면은 카카오·구글·네이버 버튼을 표시하고 Apple 버튼은 iOS에서만 표시한다.
- AC-R2-2: 로그인 진행 중 해당 버튼은 로딩, 다른 버튼은 비활성화된다.
- AC-R2-3: 성공 시 자격 증명으로 `onAuthenticated`를 호출한다.
- AC-R2-4: 취소 시 오류 메시지 없이 대기 상태로 돌아온다.
- AC-R2-5: 실패 시 사용자에게 오류 메시지를 표시하고 다시 시도할 수 있다.

## R3 - 앱 설정

### Acceptance Criteria

- AC-R3-1: 앱 ID는 `kr.pe.hoe.later`(Android package, iOS bundleIdentifier)다.
- AC-R3-2: 각 SDK의 Expo config plugin과 키를 `EXPO_PUBLIC_*` 환경변수로 구성하고 `.env.example`에 자리만 둔다. 키가 없어도 `expo config`가 실패하지 않는다.

## Out of Scope

- 우리 서버 로그인 API 호출, 토큰 저장(secure store), 자동 로그인, 로그아웃·연결 끊기.
- Android의 Apple 로그인(웹 기반 Service ID 필요).
- 최근 사용 제공자 저장, 약관·개인정보처리방침 화면.
- 실제 앱 키 발급과 콘솔(카카오·구글·네이버·Apple) 등록.
