# 모바일 소셜 로그인 구현 참고

기준: feat/auth, TASK-01M3X599CCKHC50NX77KD3AGJX, 2026-10-02. 이 문서는 API 계약과 모바일에서 구현할 책임을 설명한다.
API의 구글·카카오·네이버·Apple 인증과 Apple 서버 로그인 시도 보호는 구현되어 있다. 모바일 로그인 화면은 main에서 반영되었다. 실제 제공자 SDK·서버 로그인 연동·콜백 처리는 아직 구현하지 않았다.

현재 화면은 카카오·애플·구글 버튼이며 네이버 버튼은 없다. App.tsx의 onLogin은 실제 인증 없이 임시 상태만 바꾼다. API 지원 제공자(구글·카카오·네이버·Apple)와 화면을 연결하는 작업은 후속 모바일 범위다.

## 제공자별 전체 흐름

| 단계             | 구글                       | 카카오                  | 네이버                         | Apple                                                     |
| ---------------- | -------------------------- | ----------------------- | ------------------------------ | --------------------------------------------------------- |
| 로그인 시작      | 모바일 Google 로그인       | 모바일 Kakao 로그인     | 모바일 Naver 인가 요청         | 서버 start 호출 후 nonce로 Apple 로그인                   |
| 모바일이 얻는 값 | ID Token                   | Access Token            | code·state                     | ID Token                                                  |
| API 입력         | credential=ID Token        | credential=Access Token | credential=code·state          | credential=ID Token·loginAttemptId                        |
| API 인증         | Google 라이브러리 검증     | 토큰 정보 API           | 서버 code 교환·프로필 조회     | Apple 공개 키로 JWT 검증·nonce 시도 소비                  |
| 앱 귀속 확인     | GOOGLE_CLIENT_ID audience  | KAKAO_APP_ID app_id     | 우리 Client ID·Secret으로 교환 | APPLE_CLIENT_IDS audience                                 |
| 회원 식별        | sub                        | id                      | response.id                    | sub                                                       |
| 로그인 시도 연결 | 모바일 보호 후속 구현      | 모바일 보호 후속 구현   | 모바일 state 대조 후속 구현    | 서버 nonce 대조·5분 만료·일회 사용, 모바일 연동 후속 구현 |
| 서비스 로그인    | 회원 연결·서비스 토큰 발급 | 동일                    | 동일                           | 동일                                                      |

이메일이 같아도 계정을 자동 통합하지 않는다. 모바일이 보낸 subject로 인증하지 않는다.
제공자 토큰과 서비스 토큰은 서로 다르다. 이후 Later API에는 Later의 Access Token을 사용한다.

## 모바일 → API 계약

`POST /auth/social/login`에 JSON을 전송한다. 성공은 신규·기존 회원 모두 200이다.

```json
{ "provider": "google", "credential": "GOOGLE_ID_TOKEN" }
```

```json
{ "provider": "kakao", "credential": "KAKAO_ACCESS_TOKEN" }
```

```json
{
  "provider": "naver",
  "credential": "NAVER_AUTHORIZATION_CODE",
  "state": "STATE_FROM_AUTHORIZATION_REQUEST"
}
```

구글·카카오에는 state 필드를 보내지 않는다. 네이버에는 비어 있지 않고 공백 없는 state가 필수다.
provider/credential 및 네이버의 state, Apple의 loginAttemptId 이외의 필드는 거부한다. API는 네이버 Access Token 직접 제출을 지원하지 않는다.

```json
{
  "user": { "id": "서비스 회원 UUID" },
  "accessToken": "서비스 Access Token",
  "refreshToken": "서비스 Refresh Token",
  "tokenType": "Bearer",
  "expiresIn": 900
}
```

서비스 Refresh Token은 플랫폼 보안 저장소에 보관하고, 이후 보호 API에는 `Authorization: Bearer <서비스 Access Token>`을 사용한다.
갱신·로그아웃 계약은 [HTTP 계약](../apps/api/src/auth/presentation/http/README.md)을 따른다.
앱 복원 시 `POST /auth/token/refresh` 성공 후 새 서비스 Access Token으로 `GET /auth/me`를 호출하면 인증된 회원 ID를 얻는다. 이 API는 JWT 검증 결과이며 DB 회원 상태나 로그아웃 세션을 조회하지 않는다. 모바일 호출 구현은 이 세션의 작업 범위가 아니다.
네이버가 반환한 Access/Refresh Token은 서버의 인증 처리에만 사용하며 모바일 응답과 DB에 저장하지 않는다.

## 앱 귀속과 로그인 시도 연결은 별개

앱 귀속은 인증 정보가 Later에 등록한 제공자 앱을 대상으로 발급되었는지 확인하는 것이다.
로그인 시도 연결은 현재 모바일이 시작한 특정 로그인 요청의 결과인지 확인하는 것이다.
audience/app_id 확인이나 서버 코드 교환만으로 두 번째 검증을 완료했다고 간주하지 않는다.

state는 OAuth 리다이렉트 요청과 응답을 연결하는 무작위 값이다. nonce는 OIDC ID Token을 로그인 요청과 연결하는 값이다.
모든 제공자에 같은 state 필드를 붙이는 방식은 아니다. 사용할 SDK·리다이렉트·토큰 흐름에 따라 책임을 확인한다.
구글·카카오·네이버에는 서버 로그인 시작·시도 저장·일회 사용 기능이 없다. 구글 nonce 대조도 구현하지 않는다. Apple에는 아래 서버 시작·nonce 검증·일회 사용 기능이 있다.
네이버 state는 형식 검증 후 토큰 교환 요청에 전달할 뿐이다. 이것을 서버의 CSRF 검증으로 표현하면 안 된다.

## 네이버 모바일 구현 순서

1. 우리 NAVER_CLIENT_ID와 네이버 콘솔에 등록한 Callback URL을 사용한다. Client Secret은 모바일에 포함하지 않는다.
2. 암호학적으로 안전한 무작위 state를 로그인 시도마다 생성한다. 예상 state·시작 시각·provider를 모바일의 해당 로그인 시도에 보관한다.
3. `https://nid.naver.com/oauth2.0/authorize`로 `response_type=code`, `client_id`, `redirect_uri`, `state`를 인코딩해 요청한다.
4. 등록된 Callback URL로 받은 결과의 provider·콜백 대상·state·로그인 시도 만료를 확인한다. 예를 들어 모바일의 로그인 시도는 5분 만료로 설계한다. 이 값은 네이버 코드의 공식 만료시간이 아니다.
5. 누락·불일치·만료된 state, 취소·오류 콜백은 API로 보내지 않는다. 진행 중인 로그인 시도를 원자적으로 소비해 중복·동시 콜백을 차단한다. 병렬 로그인 시도는 각각 연결하거나 하나만 허용한다.
6. 검증한 code와 state를 즉시 Later API에 전달한다. state를 API에 보낼 때까지 해당 콜백의 값을 유지한다. 서버는 우리 앱 자격증명으로 코드 교환 후 프로필 ID를 확인한다.
7. 성공 시 서비스 토큰을 보관한다. 실패하면 새 로그인 시도를 시작한다. 네이버 코드를 토큰처럼 보관하거나 자동 재전송하지 않는다. 교환 후 서비스 처리 실패·응답 유실에도 같은 코드의 재사용 성공을 보장하지 않는다.

모바일 SDK가 Access Token만 노출하는 경우 현재 서버 계약에 바로 연결할 수 없다.
사용할 Expo/React Native 라이브러리가 인가 코드 흐름과 등록한 Callback URL을 지원하는지 먼저 확인해야 한다.
일반 네이티브 OAuth의 PKCE 권고를 네이버 지원 계약으로 단정하지 않는다. 현재 확인한 네이버 요청 변수에는 PKCE가 문서화되어 있지 않다.
SDK·딥링크 선택 및 실제 앱 로그인은 모바일 작업에서 검증한다. 임의의 외부 콜백 전달값을 받아 로그인하지 않는다.

## 구글·카카오 모바일 작업 시 확인

- 구글: 서버 audience와 맞는 Client ID로 ID Token을 요청한다. Android/iOS 앱 등록과 서버용 Client ID의 관계를 SDK 공식 문서에서 확인한다. 선택한 흐름이 nonce를 지원하면 안전하게 생성하고 토큰 결과와 대조할 검증 주체를 설계한다. 서버가 대조해야 하면 별도 API 계약 확장이 필요하다. 현재 API는 nonce를 받지 않는다.
- 카카오: Later의 KAKAO_APP_ID에 대응하는 앱으로 로그인한다. REST 인가 코드 흐름이면 state를 생성·대조하고, 네이티브 SDK이면 해당 SDK의 요청·응답 연결 보호를 공식 문서에서 확인한다. 현재 Later API에는 최종 Access Token을 전달한다.
- 두 제공자 모두 취소·오류·중복 콜백·앱 재시작·예상하지 못한 콜백을 검증한다. SDK가 모든 보호를 수행한다고 추측하지 않는다.

## 오류와 운영 설정

| 결과                                       | HTTP / error.code                  | 모바일 처리                                               |
| ------------------------------------------ | ---------------------------------- | --------------------------------------------------------- |
| 입력 형식 오류                             | 400 / BAD_REQUEST                  | 요청 구현 확인                                            |
| 인증 실패                                  | 401 / SOCIAL_AUTHENTICATION_FAILED | 새 제공자 로그인 시작                                     |
| 네이버·카카오 외부 장애 및 Apple JWKS 장애 | 503 / INTERNAL_SERVER_ERROR        | 사용자에게 일시 실패 안내; 네이버는 새 로그인 시도로 재개 |
| 예상하지 못한 서버 오류                    | 500 / INTERNAL_SERVER_ERROR        | 오류 처리; 토큰 원문을 로그에 기록하지 않음               |

현재 구글 어댑터는 라이브러리 검증 오류를 401로 통일한다. 네이버·카카오의 장애 분류와 동일하다고 가정하지 않는다.
네이버와 카카오 외부 요청은 각각 5초 제한을 적용하고 redirect를 따라가지 않는다.
설정: 서버의 GOOGLE_CLIENT_ID, KAKAO_APP_ID, NAVER_CLIENT_ID, NAVER_CLIENT_SECRET, APPLE_CLIENT_IDS 및 기존 서비스 JWT·DB 설정.
네이버 Callback URL은 모바일과 네이버 콘솔에서 관리한다. 서버의 토큰 교환은 공식 요청 변수 표에 따라 code/state/앱 자격증명을 전송하며 redirect_uri를 입력으로 받지 않는다.

## 검증 범위와 공식 근거

자동 테스트는 외부 HTTP를 대체해 코드 교환 요청, 프로필 검증, Nest HTTP·회원 연결·서비스 JWT와 저장 차단을 검증한다.
실제 네이버 앱 설정, 다른 앱 코드의 실제 거부, 코드 만료·재사용, 모바일 콜백·state/nonce 동작은 자동 테스트만으로 검증됐다고 주장하지 않는다.

- [네이버 로그인 API](https://developers.naver.com/docs/login/api/api.md): 인가 요청, state, 앱 자격증명을 사용하는 코드 교환.
- [네이버 회원 프로필](https://developers.naver.com/docs/login/profile/profile.md): Bearer 요청과 앱별 response.id. 발급 대상 앱을 확인할 audience/client_id 필드는 문서화되어 있지 않다.
- [구글 ID Token 서버 검증](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token).
- [구글 nonce 계약 참고](https://developers.google.com/identity/gsi/web/reference/js-reference): 웹 API 근거이며 모바일 SDK 계약을 대신하지 않는다.
- [카카오 로그인 REST API](https://developers.kakao.com/docs/latest/ko/kakaologin/rest-api).
- [OAuth 보안 RFC 9700](https://www.rfc-editor.org/rfc/rfc9700).

## Apple 모바일 연동

| 단계          | 모바일                                                               | 서버                                                                          |
| ------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 시도 시작     | 본문 없이 POST /auth/social/apple/start                              | UUID loginAttemptId·무작위 nonce·expiresIn=300 반환(201), nonce 해시 저장     |
| Apple 요청    | 해당 nonce를 Apple 인증 요청의 nonce에 그대로 전달                   | 대기                                                                          |
| 로그인 결과   | Apple ID 토큰과 원래 loginAttemptId를 POST /auth/social/login에 전달 | 고정 Apple 공개 키로 서명·issuer·audience·만료·sub·nonce 검증                 |
| 시도 확인     | 응답 대기                                                            | 검증된 nonce 해시와 저장된 시도를 대조, 만료 전 미사용 시도만 원자적으로 소비 |
| 서비스 로그인 | 서비스 토큰을 보안 저장소에 보관                                     | (apple, sub) 회원 연결과 기존 서비스 토큰 발급                                |

```json
{
  "provider": "apple",
  "credential": "APPLE_ID_TOKEN",
  "loginAttemptId": "START_RESPONSE_UUID"
}
```

Apple 요청에는 서버가 반환한 nonce를 **그대로** 넣는다. SDK가 nonce를 자동으로 SHA-256 처리하는지 공식 SDK 계약으로 확인한다. 최종 Apple 요청의 nonce가 서버 반환값과 같아야 한다. 모바일에서 임의로 다시 해시하면 현재 서버 계약과 불일치한다.
loginAttemptId는 같은 로그인 화면의 시도와 연결해 보관한다. 취소·앱 재시작·5분 경과·중복 결과·예상하지 못한 콜백은 폐기한다. 웹 리다이렉트 흐름의 state 생성·대조도 클라이언트에서 별도로 구현해야 한다. 서버 nonce 검증이 클라이언트의 잘못된 콜백 처리를 대신하지 않는다.
서버는 검증 후 회원·서비스 세션 생성 전에 시도를 소비한다. 로그인 요청 재사용·응답 유실·DB 오류 시에는 새 시작 요청과 새 Apple 인증으로 재개한다. JWKS 장애는 503이며 시도를 소비하지 않지만 만료되면 새로 시작한다.

서버 APPLE_CLIENT_IDS는 쉼표 구분 목록이며 공백을 넣지 않는다. iOS는 실제 Bundle ID, 웹/Android는 해당 Services ID를 등록한다. Apple 콘솔의 Sign in with Apple capability, 앱·Services ID·도메인·return URL을 플랫폼에 맞게 설정한다. SDK에서 ID 토큰을 얻는 흐름을 사용해야 한다. ID 토큰 검증에는 Apple private key·Team ID·Key ID·client secret이 필요하지 않다. code 교환·refresh/revoke를 구현할 때 별도 설정이 필요하다.

Apple JWKS는 캐시하며 5초 조회 제한과 redirect 거부를 적용한다. 키 교체 시 라이브러리가 cooldown 이후 다시 조회한다. 새 키 직후 캐시로 거부되면 잠시 후 새 로그인으로 재시도한다. DB 만료·사용 완료 시도 행의 자동 삭제는 아직 없으므로 운영 정리 정책이 필요하다.
Apple 이메일 숨기기·첫 로그인 이름 제공에 의존하지 않고 검증된 sub로 회원을 식별한다. 제공자 refresh token·연결 해제·Apple 계정 상태 변경과 서비스 세션 동기화는 구현하지 않았다. 현재 서비스 세션은 기존 30일 정책이다.

자동 테스트는 실제 RSA 서명·JWT 검증, HTTP, later_test 시도 소비와 실제 DI·회원·세션 저장을 검증한다. 실제 Apple 콘솔·모바일 SDK·사용자 로그인은 아직 검증하지 않았다.
[Apple 인증](https://developer.apple.com/documentation/signinwithapple/authenticating-users-with-sign-in-with-apple), [Apple 사용자 검증](https://developer.apple.com/documentation/signinwithapple/verifying-a-user), [Apple ID 토큰](https://developer.apple.com/documentation/signinwithapple/receiving-a-users-identity-token).
