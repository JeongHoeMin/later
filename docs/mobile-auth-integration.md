# 모바일 인증 API 연결

기준: feat/auth, 2026-10-02. 서버 인증 API와 모바일 HTTP 클라이언트·세션 관리 코드는 구현되어 있다. **현재 App.tsx의 임시 로그인 버튼은 실제 인증을 호출하지 않는다.** 제공자 SDK와 화면 연결, 실제 기기 검증은 별도 작업이다.

## API 문서 조회

서버 실행 후 `GET /docs-json`으로 OpenAPI JSON을 조회한다. `GET /docs`는 Swagger UI다. 코드 변경 후 서버를 다시 빌드·실행하면 현재 컨트롤러 계약을 반영한다. 호출 주소·상태·요청별 필수 입력은 [Swagger 설정](openapi.md), 시도 연결·state/nonce는 [로그인 프로세스](social-login-process.md)를 확인한다.

## 앱 조립

`apps/mobile/.env.example`을 `.env.local`로 복사해 `EXPO_PUBLIC_API_BASE_URL`을 설정한다. 이 값은 공개 앱 번들에 포함된다. HTTPS 서버 주소를 사용하고 로컬 개발 시 기기에서 접근할 수 있는 주소를 사용한다. Android 에뮬레이터·실제 기기의 localhost는 개발 PC가 아니다. 서버 Client Secret·JWT Secret·DB URL을 앱에 넣지 않는다.

인증 화면 연결 시 아래 인스턴스를 앱 범위에서 **한 번** 만들고 공유한다. 여러 인스턴스를 만들면 동시 갱신 보호를 공유하지 못한다. 설정 누락 오류는 앱에서 안내하고 로그인 버튼을 비활성화한다.

```ts
import { AuthApiClient } from '../features/auth/auth-api-client.js';
import { AuthSession } from '../features/auth/auth-session.js';
import { SecureSessionStore } from '../features/auth/secure-session-store.js';

const api = new AuthApiClient(process.env.EXPO_PUBLIC_API_BASE_URL ?? '');
const session = new AuthSession(api, new SecureSessionStore());
```

예시는 `src/app/`에서의 상대 경로다. Expo 환경 변수는 `process.env.EXPO_PUBLIC_API_BASE_URL`처럼 정적으로 참조해야 한다. [Expo 환경 변수 공식 문서](https://docs.expo.dev/guides/environment-variables/).

| 과정                 | 모바일 호출                                                                                         | 서버 검증                             |
| -------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Google SDK 결과      | `session.login({ provider: 'google', credential: idToken })`                                        | 서버용 Web Client ID audience         |
| Kakao SDK 결과       | `session.login({ provider: 'kakao', credential: accessToken })`                                     | 등록한 숫자 앱 ID                     |
| Naver 콜백 검증 완료 | `session.login({ provider: 'naver', credential: code, state })`                                     | 앱 자격증명 code 교환·프로필          |
| Apple 시작           | `const attempt = await api.startApple()`                                                            | nonce/시도 발급                       |
| Apple 인증 결과      | `session.login({ provider: 'apple', credential: idToken, loginAttemptId: attempt.loginAttemptId })` | 서명·audience·nonce·만료·일회 사용    |
| 앱 재시작            | `await session.restore()`                                                                           | 저장 refresh token 검증·회전          |
| 보호 API 요청 전     | `await session.getAccessToken()`                                                                    | 유효 access 반환, 만료30초 전 refresh |
| 로그아웃             | `await session.logout()`                                                                            | 로컬 삭제·해당 서비스 세션 폐기       |

Apple SDK에는 attempt.nonce를 그대로 전달한다. Naver state는 콜백 대상·시도·만료와 대조한 뒤 전달한다. 이 클라이언트는 SDK·콜백 검증을 대신하지 않는다. Google/Kakao 요청에 state 필드를 추가하지 않는다. 제공자별 상세 계약은 로그인 프로세스 문서를 따른다.

## 세션 처리

로그인 Promise가 완료되기 전에는 인증 성공 화면으로 이동하지 않는다. refresh token·회원 ID·provider만 SecureStore에 저장하고 access token은 메모리에 둔다. 회원 ID는 표시 정보이며 인증 증거가 아니다. 재시작 시 저장 자료만 읽어 로그인시키지 않고 서버 갱신 성공 후 상태를 복원한다.

`getAccessToken()`이 문자열을 반환할 때만 보호 API에 `Authorization: Bearer <반환값>`을 붙인다. null이면 로그인 화면이 필요하다. 만료 시 동시 호출은 한 refresh 요청을 공유하며 login/restore/logout 경계에서는 이전 조회와 합쳐지지 않는다. 상태 변경은 직렬화한다. 갱신의30일 세션 만료는 연장되지 않는다.

앱 정지나 저장 지연으로 갱신한 access token도 이미 만료됐다면 이를 반환하지 않고 오류를 전달한다. 같은 호출에서 자동 갱신을 반복하지 않는다. 다음 사용자 요청은 저장된 최신 refresh token으로 새로 갱신할 수 있다.

로그인·갱신·Apple 시작·로그아웃 HTTP 요청에는 서비스 bearer를 넣지 않는다. 각 요청은15초 제한이며 자동 재시도하지 않는다. refresh 응답 유실 후 기존 token으로 재시도하면 서버가 세션을 폐기할 수 있다. 오류가 난 호출은 사용자 흐름에서 처리하고 무한 재시도/무한 재로그인을 만들지 않는다.

| 오류                           | 처리                                                                                              |
| ------------------------------ | ------------------------------------------------------------------------------------------------- |
| `AuthApiError.kind === 'http'` | status와 허용된 error.code로 분기.400 구현 확인, 로그인401 새 제공자 로그인, refresh401 로컬 삭제 |
| network / timeout              | 일시 실패 안내. 복원용 refresh 저장은 유지하되 인증 완료로 표시하지 않음                          |
| invalid-response               | 계약 불일치 안내. 토큰을 저장하지 않음                                                            |
| 저장소 실패                    | 성공 상태를 게시하지 않고 발급/회전된 서버 세션 폐기를 시도. 정리 실패 가능성을 사용자에게 안내   |
| 로그아웃 서버 실패             | 로컬 삭제 후 오류 전달. 서버 폐기 성공을 주장하지 않음                                            |

401 refresh 실패는 로컬 세션을 제거한다. 다른 실패의 저장 자료는 유지한다. 저장 실패 후 정리도 실패하면 서버·기기 정리가 보장되지 않는다. 계정 전환은 먼저 logout을 완료한 뒤 새 login을 실행한다. 오류 메시지·토큰·credential을 콘솔이나 분석 이벤트에 기록하지 않는다.

## native 설정과 남은 연결

Expo57 호환 `expo-secure-store`와 config plugin을 추가했다. iOS는 잠금 해제 상태의 기기 전용 Keychain 접근 옵션을 사용하며 Android는 Keystore 기반 저장과 plugin의 백업 제외 설정을 사용한다. 생체 인증 요구는 켜지 않았다. iOS 재설치 후 Keychain 자료가 남을 수 있으므로 저장 자료의 존재를 로그인 완료로 판단하지 않는다. [Expo57 SecureStore 문서](https://docs.expo.dev/versions/v57.0.0/sdk/securestore/).

새 native 의존성 반영에는 개발 빌드를 다시 만들어야 한다. 아직 실제 기기의 저장/복원·네트워크 전환·앱 재시작은 검증하지 않았다. 자동 테스트는 HTTP 경계와 native 저장 경계만 대체하고 클라이언트/세션 로직을 실제로 연결한다.

SDK/화면 연결 시 각 제공자를 별도 Task로 진행한다. 등록된 iOS Bundle ID·Android package/signing·Google iOS/Web Client ID·Kakao Native App Key·Naver callback/state 흐름·Apple 플랫폼별 capability/Services ID 설정을 먼저 확인한다. iOS용 SDK를 Android에서도 지원한다고 가정하지 않는다. 현재 화면의 카카오·Apple·Google 버튼 및 네이버 미노출 상태는 그대로다.
