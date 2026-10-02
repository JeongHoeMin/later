# 모바일 소셜 로그인 구현 참고

기준: feat/auth, TASK-009, 2026-10-02. 이 문서는 API 계약과 모바일에서 구현할 책임을 설명한다.
API의 구글·카카오·네이버 인증은 구현되어 있다. 모바일 로그인 화면·SDK·콜백·로그인 시도 보호는 아직 구현하지 않았다.

## 제공자별 전체 흐름

| 단계               | 구글                                                            | 카카오                                  | 네이버                                               |
| ------------------ | --------------------------------------------------------------- | --------------------------------------- | ---------------------------------------------------- |
| 로그인 시작        | 모바일에서 Google 로그인                                        | 모바일에서 Kakao 로그인                 | 모바일에서 Naver 인가 요청                           |
| 사용자 로그인·동의 | Google에서 처리                                                 | Kakao에서 처리                          | Naver에서 처리                                       |
| 모바일이 얻는 값   | ID Token                                                        | Access Token                            | 인가 코드(code)와 state                              |
| API에 전달         | provider=google, credential=ID Token                            | provider=kakao, credential=Access Token | provider=naver, credential=code, state               |
| API 인증           | Google 라이브러리로 토큰 검증                                   | 토큰 정보 API 호출                      | 서버의 Client ID·Secret으로 코드 교환 후 프로필 조회 |
| 발급 대상 앱 확인  | audience가 GOOGLE_CLIENT_ID와 일치                              | app_id가 KAKAO_APP_ID와 일치            | 우리 앱의 Client ID·Secret을 사용한 코드 교환        |
| 회원 식별          | 검증된 sub                                                      | 검증된 id                               | 프로필 response.id                                   |
| 서비스 로그인      | 검증된 (provider, subject)로 회원 조회·생성 후 서비스 토큰 발급 | 동일                                    | 동일                                                 |

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
provider/credential 및 네이버의 state 이외의 필드는 거부한다. API는 네이버 Access Token 직접 제출을 지원하지 않는다.

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
네이버가 반환한 Access/Refresh Token은 서버의 인증 처리에만 사용하며 모바일 응답과 DB에 저장하지 않는다.

## 앱 귀속과 로그인 시도 연결은 별개

앱 귀속은 인증 정보가 Later에 등록한 제공자 앱을 대상으로 발급되었는지 확인하는 것이다.
로그인 시도 연결은 현재 모바일이 시작한 특정 로그인 요청의 결과인지 확인하는 것이다.
audience/app_id 확인이나 서버 코드 교환만으로 두 번째 검증을 완료했다고 간주하지 않는다.

state는 OAuth 리다이렉트 요청과 응답을 연결하는 무작위 값이다. nonce는 OIDC ID Token을 로그인 요청과 연결하는 값이다.
모든 제공자에 같은 state 필드를 붙이는 방식은 아니다. 사용할 SDK·리다이렉트·토큰 흐름에 따라 책임을 확인한다.
현재 API는 로그인 시작 엔드포인트, state 보관·원본 대조·일회 사용 검증, 구글 nonce 대조를 구현하지 않는다.
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

| 결과                                                | HTTP / error.code                  | 모바일 처리                                               |
| --------------------------------------------------- | ---------------------------------- | --------------------------------------------------------- |
| 입력 형식 오류                                      | 400 / BAD_REQUEST                  | 요청 구현 확인                                            |
| 인증 실패                                           | 401 / SOCIAL_AUTHENTICATION_FAILED | 새 제공자 로그인 시작                                     |
| 네이버·카카오 외부 장애, 통신·타임아웃, 비정상 응답 | 503 / INTERNAL_SERVER_ERROR        | 사용자에게 일시 실패 안내; 네이버는 새 로그인 시도로 재개 |
| 예상하지 못한 서버 오류                             | 500 / INTERNAL_SERVER_ERROR        | 오류 처리; 토큰 원문을 로그에 기록하지 않음               |

현재 구글 어댑터는 라이브러리 검증 오류를 401로 통일한다. 네이버·카카오의 장애 분류와 동일하다고 가정하지 않는다.
네이버와 카카오 외부 요청은 각각 5초 제한을 적용하고 redirect를 따라가지 않는다.
설정: 서버의 GOOGLE_CLIENT_ID, KAKAO_APP_ID, NAVER_CLIENT_ID, NAVER_CLIENT_SECRET 및 기존 서비스 JWT·DB 설정.
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
