> 현재 구현된 서비스 정책은 [서비스 정책](service-policy.md)을 기준으로 한다. 이 문서는 앱과 서버의 소셜 로그인 연동 절차다.

# 소셜 로그인 서버 계약과 모바일 연동 참고

기준: feat/auth, 2026-10-02. 구현된 서버 API와 모바일 연동 계약을 설명한다. 모바일 코드와 기기 로그인 검증은 이번 서버 작업에 포함하지 않는다. 실행 중인 서버의 계약은 GET /docs-json으로 확인하며 코드 변경 후 재시작 또는 배포가 필요하다.

## 제공자별 단계

| 단계           | Google                               | Kakao                                   | Naver                                                | Apple                                               |
| -------------- | ------------------------------------ | --------------------------------------- | ---------------------------------------------------- | --------------------------------------------------- |
| 시작           | 앱 Google SDK                        | 앱 Kakao SDK                            | POST /auth/social/naver/start                        | POST /auth/social/apple/start                       |
| 제공자 요청    | 서버 audience로 ID Token 요청        | Access Token 획득                       | 서버 authorizationUrl을 브라우저로 열기              | 서버 nonce로 Apple 인증                             |
| 제공자 결과    | 앱에 ID Token                        | 앱에 Access Token                       | 서버 Callback에 code/state 또는 error/state          | 앱에 ID Token                                       |
| 앱으로 복귀    | SDK 결과                             | SDK 결과                                | 서버 state 검증 후 고정 앱 URI로 303, 시도 ID만 전달 | SDK 결과                                            |
| 서비스 로그인  | POST /auth/social/login              | POST /auth/social/login                 | POST /auth/social/login                              | POST /auth/social/login                             |
| 본문           | provider=google, credential=ID Token | provider=kakao, credential=Access Token | provider=naver, loginAttemptId, attemptSecret        | provider=apple, credential=ID Token, loginAttemptId |
| 서버 인증      | 서명·issuer·audience·만료·sub        | 토큰 정보 app_id·만료·id                | 저장 시도·비밀값 검증, code 교환·프로필 ID           | 서명·issuer·audience·만료·sub·nonce                 |
| 서버 시도 보호 | 전용 시도 API 없음                   | 전용 시도 API 없음                      | state 대조·5분 만료·중복 콜백 차단·일회 완료         | nonce 대조·5분 만료·일회 사용                       |
| 서비스 응답    | 회원 ID와 Later 토큰                 | 동일                                    | 동일                                                 | 동일                                                |

회원은 검증된 (provider, subject)로 식별한다. 이메일이 같다는 이유로 계정을 합치거나 앱이 보낸 subject를 신뢰하지 않는다. 이후 API에는 Later Access Token을 사용한다.

## 네이버 시작 → 서버 Callback → 앱 → 완료

1. 앱이 본문 없이 `POST /auth/social/naver/start`를 호출한다. 빈 객체도 허용하며 추가 필드는 400이다.
2. 서버는 독립적인 state/attemptSecret과 UUID v4 시도 ID를 생성한다. DB에는 state/비밀값 해시와 만료 시각을 저장한다. 응답은 201이다.

```json
{
  "loginAttemptId": "SERVER_ISSUED_UUID",
  "attemptSecret": "SERVER_ISSUED_SECRET",
  "authorizationUrl": "https://nid.naver.com/oauth2.0/authorize?...",
  "expiresIn": 300
}
```

3. 앱은 ID와 비밀값을 해당 시도에 연결해 보관하고 authorizationUrl을 브라우저로 연다. URL을 재작성하거나 비밀값을 URL·로그에 넣지 않는다. state는 서버가 인가 URL에 포함한다.
4. 네이버는 등록된 **https://later.hoe.pe.kr/auth/social/naver/callback**으로 브라우저를 보낸다. 사용자가 등록을 완료했다. 로그인 Callback이며 연결 끊기 Callback과 다르다. 콘솔의 내 애플리케이션 → API 설정 → 로그인 오픈 API 서비스 환경에서 설정한다.
5. `GET /auth/social/naver/callback`은 성공 code/state 또는 실패 error/state를 받는다. code/error 동시 제출·중복 query 값·누락·빈 code 등 입력 오류는 400이다. 서버는 저장 state 해시와 대조하고 만료·중복 콜백을 거부한다. code/state는 AES-256-GCM으로 암호화해 일시 저장한다.
6. 유효하면 고정 NAVER_LOGIN_APP_RETURN_URL에 **303**으로 이동한다. 예: `later://auth/naver?loginAttemptId=UUID`. **앱 반환 URL에는 code·state·attemptSecret·제공자 토큰·서비스 토큰을 넣지 않는다.** 취소도 ID만 전달하며 완료 API에서 401이다. 잘못된 state는 앱으로 리다이렉트하지 않는다.
7. 앱은 받은 ID가 자신이 보관한 시도와 일치하는지 확인한 뒤 `POST /auth/social/login`을 호출한다. ID만 아는 다른 앱/브라우저는 완료할 수 없다.

```json
{
  "provider": "naver",
  "loginAttemptId": "START_RESPONSE_UUID",
  "attemptSecret": "START_RESPONSE_SECRET"
}
```

8. 서버는 비밀값·콜백 완료·만료·미사용을 검증해 원자적으로 소비한다. 암호화 grant를 DB에서 지운 뒤 서버 Client ID/Secret으로 코드를 교환하고 프로필 response.id로 회원을 연결한다. 서비스 세션 저장 후 200이다.

앱이 서버용 state 생성·대조·만료·일회 사용을 구현하는 계약이 아니다. 앱 책임은 시도 ID/비밀값 보관, 브라우저 열기, 자신의 시도 딥링크 수신 확인, 완료 요청, 서비스 토큰 저장이다. 예상하지 못한 ID·잃은 비밀값·중복 결과는 새 로그인으로 재개한다.

**기존 POST /auth/social/login에 provider=naver, credential=code, state를 보내면 400이다.** 네이버 Access Token 직접 제출도 지원하지 않는다. Access Token만 노출하는 네이티브 SDK는 이 계약에 바로 연결할 수 없으므로 서버 인가 URL을 사용하는 브라우저 흐름으로 연동한다. `/auth/naver/callback`은 존재하지 않는다.

## Google·Kakao·Apple 입력

`POST /auth/social/login`은 네 형식만 허용하며 성공은 200이다.

```json
{ "provider": "google", "credential": "GOOGLE_ID_TOKEN" }
```

```json
{ "provider": "kakao", "credential": "KAKAO_ACCESS_TOKEN" }
```

Apple은 본문 없이 `POST /auth/social/apple/start`를 호출해 201의 loginAttemptId, nonce, expiresIn=300을 받는다. nonce를 Apple 인증 요청에 **그대로** 전달한다. SDK의 자동 해시 여부를 확인해 최종 요청 nonce가 서버 값과 같도록 한다.

```json
{
  "provider": "apple",
  "credential": "APPLE_ID_TOKEN",
  "loginAttemptId": "START_RESPONSE_UUID"
}
```

Google은 GOOGLE_CLIENT_ID와 같은 audience의 ID Token을 요청한다. Android/iOS 등록 ID와 서버용 웹 Client ID 관계는 선택 SDK 계약에 맞춘다. 서버에 Google Client Secret은 필요하지 않다. Kakao는 KAKAO_APP_ID에 해당하는 앱의 Access Token을 보내며 서버가 app_id를 검증한다. 숫자 앱 ID이며 REST API 키가 아니다.

state는 OAuth 요청·리다이렉트 응답을 연결하고 nonce는 OIDC 토큰을 인증 요청에 연결한다. audience/app_id 앱 귀속 검증은 시도 연결과 별개다. 모든 제공자에 공통 state 필드를 추가하는 계약은 아니다. Google/Kakao에는 서버 시작·state/nonce 대조 API가 없으므로 SDK/리다이렉트 요청 결과 연결은 모바일 담당이 확인한다. Apple 웹 리다이렉트 state도 클라이언트에서 별도로 관리한다. Apple code 교환·제공자 refresh/revoke는 구현하지 않았다.

## 서비스 토큰·앱 복원·로그아웃

모든 제공자의 성공 응답은 동일하다.

```json
{
  "user": { "id": "LATER_USER_UUID" },
  "accessToken": "LATER_ACCESS_TOKEN",
  "refreshToken": "LATER_REFRESH_TOKEN",
  "tokenType": "Bearer",
  "expiresIn": 900
}
```

Access Token 15분, 서비스 세션 30일. Refresh Token은 플랫폼 보안 저장소에 보관한다. DB에는 해시만 저장하며 제공자 토큰은 저장·반환하지 않는다.

- `POST /auth/token/refresh`: {"refreshToken":"LATER_REFRESH_TOKEN"}. 200 새 토큰. 이전 토큰 소비, 세션 만료 연장 없음. 갱신 요청을 직렬화하고 새 토큰으로 교체한다. 소비한 토큰 재사용은 해당 세션을 폐기한다.
- `GET /auth/me`: Authorization: Bearer 서비스 Access Token. 200 {"user":{"id":"LATER_USER_UUID"}}. 갱신 응답에 user가 없으므로 앱 복원 시 새 Access Token으로 호출한다.
- `POST /auth/logout`: 같은 refreshToken 본문. 해당 세션 폐기 후 204. 이미 폐기된/알 수 없는 토큰도 204, 다른 기기 세션 유지.

/auth/me는 JWT와 DB 회원 존재를 확인한다. 탈퇴 회원은 거부하며 세션 폐기 상태·별도 권한은 조회하지 않는다. 로그아웃 후 기존 Access Token도 만료까지 유효하다.

## 오류와 재시도

| 상황                                              | HTTP / error.code                  | 처리                    |
| ------------------------------------------------- | ---------------------------------- | ----------------------- |
| 입력 오류                                         | 400 / BAD_REQUEST                  | 요청 계약 수정          |
| 소셜 인증 실패·시도 불일치·만료·재사용·취소       | 401 / SOCIAL_AUTHENTICATION_FAILED | 새 로그인               |
| 브리지 설정 누락 또는 Kakao/Naver/Apple 외부 장애 | 503 / INTERNAL_SERVER_ERROR        | 일시 실패 안내, 새 시도 |
| 내부 오류                                         | 500 / INTERNAL_SERVER_ERROR        | 토큰 원문 비기록        |
| Refresh Token 실패                                | 401 / INVALID_REFRESH_TOKEN        | 새 로그인               |
| /auth/me 헤더 누락·형식 오류                      | 401 / AUTHENTICATION_REQUIRED      | 서비스 Bearer 제출      |
| /auth/me 서비스 JWT 실패                          | 401 / INVALID_ACCESS_TOKEN         | 갱신 또는 로그인        |

공통 오류는 {"error":{"code":"...","message":"...","details":["..."]}}이며 details는 선택이다. Google 라이브러리 검증 오류는 401로 통일한다.
네이버/Apple 시도는 회원·세션 저장 전에 소비한다. 이후 실패나 응답 유실 시 같은 시도로 재시도하지 말고 새 start로 재개한다. 중복 네이버 콜백도 거부한다. 300초는 우리 시도 정책이며 네이버 코드의 공식 만료시간을 뜻하지 않는다.

## 서버 설정과 운영 적용

[환경 예시](../apps/api/.env.example)를 따른다.

| ENV                                   | 값/책임                                                               |
| ------------------------------------- | --------------------------------------------------------------------- |
| GOOGLE_CLIENT_ID                      | 허용 Google audience                                                  |
| KAKAO_APP_ID                          | 숫자 앱 ID                                                            |
| NAVER_CLIENT_ID / NAVER_CLIENT_SECRET | 서버 코드 교환, Secret은 앱에 포함 금지                               |
| NAVER_LOGIN_CALLBACK_URL              | https://later.hoe.pe.kr/auth/social/naver/callback (사용자 등록 완료) |
| NAVER_LOGIN_APP_RETURN_URL            | 실제 앱 고정 URI. later://auth/naver는 예시, 실제 값 아직 미제공      |
| NAVER_LOGIN_BRIDGE_KEY                | 별도 무작위 32바이트 키를 base64url 43자로 인코딩, JWT 키 재사용 금지 |
| APPLE_CLIENT_IDS                      | 실제 사용하는 Bundle ID/Services ID 허용 목록, 쉼표 구분              |
| ACCESS_TOKEN_SECRET / DATABASE_URL    | 기존 JWT 키와 환경별 PostgreSQL                                       |

앱 반환 주소와 브리지 키를 설정하지 않으면 네이버 경로는 503이다. 브리지 ENV를 다른 제공자 경로의 시작 조건으로 요구하지는 않는다. 앱 URI는 HTTPS 또는 허용 커스텀 스킴의 고정 주소다. query·fragment·URL 인증 정보 금지. Callback은 HTTPS이고 경로는 /auth/social/naver/callback. 요청에서 redirect URI를 선택할 수 없다.

브리지 키는 서버 인스턴스 간 같아야 한다. 교체하면 진행 중인 암호화 시도를 사용할 수 없어 새 로그인이 필요하다. 완료 grant는 소비 시 삭제하며 만료된 시도·세션은 서버 시작 1시간 후부터 매시간 테이블별 최대 500개 자동 정리한다. 사용 완료 토큰은 세션 만료까지 보존한다.

운영 적용에는 새 서버 재시작/배포, 운영 DB migration deploy, 실제 앱 URI/키와 HTTPS 경로 연결이 필요하다. 개발 later_dev/테스트 later_test에는 migration을 적용했다. 콘솔 URL 등록이 서버 배포 완료를 뜻하지 않는다. 프록시 접근 로그에서 Callback의 code/state query와 인증 본문·토큰을 제외한다. 새 네이버 응답은 no-store, Callback은 no-referrer이다.

## 문서와 검증 범위

모바일 개발자는 GET /docs-json과 GET /docs로 현재 실행 서버의 계약을 확인한다. 네이버 시작/콜백과 공통 로그인가 없다면 최신 버전 서버인지 확인하고 재시작/배포한다. 저장소 구현과 실행 서버 버전을 구분한다.
자동 테스트는 실제 Flow·암호화·네이버 어댑터·JWT를 사용하며 외부 HTTP만 대체한다. DB 통합 테스트는 실제 PostgreSQL로 만료·비밀값·동시 콜백/완료 일회 사용을 검증한다. 실제 네이버 계정·운영 HTTPS·앱 딥링크 동작은 아직 미검증이다.

- [HTTP 계약](../apps/api/src/auth/presentation/http/README.md), [OpenAPI 안내](openapi.md)
- [네이버 공식 인증 명세](https://developers.naver.com/docs/login/api/api.md)
- [네이버 프로필](https://developers.naver.com/docs/login/profile/profile.md)
- [Google 서버 토큰 검증](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token)
- [Kakao 공식 계약](https://developers.kakao.com/docs/latest/ko/kakaologin/rest-api)
- [OAuth 보안 RFC 9700](https://www.rfc-editor.org/rfc/rfc9700)

최종 서비스 로그인 경로는 네 제공자 모두 POST /auth/social/login으로 통일한다. 이전 /auth/social/naver/complete는 제거되어 404이며 클라이언트는 공통 경로와 provider=naver 본문을 사용해야 한다.

## 회원 탈퇴와 소셜 계정 연동

일반 로그아웃은 해당 기기 Refresh Token 세션만 폐기한다. 회원 탈퇴는 서비스 Bearer로 `DELETE /users/me`를 호출하며 회원·소셜 연결·모든 기기 세션을 즉시 삭제한다. 이후 기존 JWT도 회원 존재 확인에서 거부한다. 재가입은 새 회원 ID다.

로그인한 사용자는 `GET /users/me/social-accounts`로 연결된 제공자를 조회하고 `POST /users/me/social-accounts`로 추가한다. 예: 네이버로 로그인한 상태에서 Google 인증을 완료해 연동하면 이후 Google/Naver 로그인 모두 같은 회원을 반환한다. 연동 응답은 연결 정보만이며 현재 서비스 토큰을 교체하지 않는다.

Apple/Naver 연동은 `/users/me/social-accounts/apple/start`, `/users/me/social-accounts/naver/start`를 Bearer로 먼저 호출한다. 일반 로그인용 시작 시도와 혼용할 수 없고 다른 회원이 완료할 수 없다. Naver callback 주소는 기존 서버 callback을 재사용한다. 앱은 시작 당시의 로그인 회원과 ID/비밀값을 유지하며 회원이 바뀌면 새 연동으로 시작한다.

동일 계정 연결은 새 유효 인증 증거로 재시도하면200, 다른 회원에게 연결됐거나 같은 제공자의 다른 계정이면409 SOCIAL_ACCOUNT_CONFLICT다. 일회용 시도는 성공·소비 후 재전송하지 않는다. 계정 병합/교체/연동 해제는 지원하지 않는다. 자세한 입력·오류·탈퇴 범위는 [HTTP 계약](../apps/api/src/auth/presentation/http/README.md)을 따른다.

## 인증 요청 제한

로그인·시작·callback은 IP별 합계 60초 20회, 갱신과 로그아웃은 각각 IP별 60회, 연동·연동 시작은 IP별 및 회원별 각각 합계 10회다. 초과 시 429/RATE_LIMIT_EXCEEDED와 Retry-After 초를 받으며 대기 후 재시도한다. 상세 창·프록시·장애 정책은 [서비스 정책](service-policy.md#인증-api-요청-제한)을 따른다.
