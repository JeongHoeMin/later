현재 구현된 사용자 규칙과 보존·탈퇴·제한 정책은 [서비스 정책](../../../../../../docs/service-policy.md)을 따른다.

# 소셜 로그인 HTTP API

`POST /auth/social/login`

구글·Apple ID 토큰, 카카오 Access Token, 네이버 서버 시도 ID/비밀값을 지원한다. 최종 서비스 로그인은 이 공통 경로로 통일한다.
모바일 로그인 과정과 state/nonce 책임은 [로그인 프로세스](../../../../../../docs/social-login-process.md)를 참고한다.

```json
{
  "provider": "google",
  "credential": "GOOGLE_ID_TOKEN"
}
```

- provider는 `google`, `kakao`, `naver` 또는 `apple`이어야 한다.
- Google/Kakao/Apple credential은 비어 있지 않은 문자열이어야 한다. 네이버는 credential 없이 loginAttemptId/attemptSecret을 제출한다.
- 추가 필드와 잘못된 본문은 400으로 거부한다.
- 회원 식별에는 검증된 구글 토큰의 sub를 사용한다.

카카오 요청:

```json
{
  "provider": "kakao",
  "credential": "KAKAO_ACCESS_TOKEN"
}
```

서버는 카카오 토큰 정보 API를 호출해 `app_id`가 설정한 `KAKAO_APP_ID`와 같고 `expires_in`이 양수인지 확인한다.
검증한 `id`를 subject로 사용한다. 앱 ID는 카카오디벨로퍼스 앱의 숫자 ID이며 REST API 키가 아니다.
`KAKAO_APP_ID`가 없거나 양의 안전한 정수가 아니면 AuthModule 구성 시 오류가 발생한다. `.env.example`을 참고한다.
카카오 토큰 원문은 검증 요청의 Authorization 헤더로만 전달하고 DB에는 저장하지 않는다.
외부 요청은 5초 제한을 적용하고 redirect를 따라가지 않는다.
카카오 응답의 ID가 JavaScript에서 정밀도 손실 없이 표현 가능한 양의 정수가 아니면 응답 오류로 거부한다.
외부 인증 동작은 [카카오 공식 문서](https://developers.kakao.com/docs/ko/kakaologin/rest-api#access-token-info)를 따른다.

성공 응답은 기존 회원과 신규 회원 모두 200이다.

## 네이버 서버 로그인

기존 POST /auth/social/login의 provider=naver 직접 code/state 제출은 400으로 거부한다.

1. POST /auth/social/naver/start: 본문 없음 또는 {}. 201 {loginAttemptId, attemptSecret, authorizationUrl, expiresIn:300}. 앱은 ID/비밀값을 보관하고 URL을 브라우저로 연다.
2. GET /auth/social/naver/callback: 네이버의 code/state 또는 error/state를 서버가 받는다. state 해시·만료·미사용 콜백을 검증하고 암호화 grant를 일시 저장한다. 303 Location은 고정 앱 URI와 loginAttemptId만 포함한다. code/state/비밀값/토큰을 앱 URL에 전달하지 않는다. 취소도 앱에 ID만 반환한다.
3. POST /auth/social/login: {provider:naver, loginAttemptId, attemptSecret}. 앱 보관 비밀값·콜백 완료·5분 만료·일회 사용을 검증한 뒤 서버 code 교환·프로필 확인·회원/세션 발급. 성공 200은 아래 공통 응답. 준비 전·불일치·만료·재사용·취소는 401 SOCIAL_AUTHENTICATION_FAILED. 입력 400, 설정/외부 장애 503 INTERNAL_SERVER_ERROR.

서버 NAVER_LOGIN_CALLBACK_URL은 https://later.hoe.pe.kr/auth/social/naver/callback (사용자 콘솔 등록 완료). NAVER_LOGIN_APP_RETURN_URL은 실제 앱 URI로 설정해야 한다. later://auth/naver는 예시이며 실제 값은 아직 미제공. NAVER_LOGIN_BRIDGE_KEY는 별도 32바이트 무작위 base64url 키다. 브리지 설정은 사용 시 검사하며 누락이면 503이다.

NAVER_CLIENT_ID/NAVER_CLIENT_SECRET은 서버에서만 사용하며 기존 설정 누락은 모듈 구성에서 거부한다. 시도에는 state/비밀값 해시와 AES-GCM 암호화 code/state를 저장한다. 완료 시 grant를 삭제하고 외부 교환 전에 시도를 소비하므로 이후 실패·응답 유실은 새 start로 재개한다. 만료 행 자동 정리는 아직 없다. 네이버 제공자 토큰은 저장/반환하지 않는다. 회원은 프로필 response.id로 식별하며 외부 요청 각각 5초 제한, redirect 거부를 적용한다.

새 네이버 API 응답은 Cache-Control: no-store, 콜백은 Referrer-Policy: no-referrer. 프록시 로그의 code/state query도 제외한다. 앱이 서버 state 대조/만료/일회 사용을 대신하는 계약이 아니다. 실제 딥링크 수신·시도 ID 연결·비밀값 보관은 앱 책임이다.
상세 단계·오류·설정은 [로그인 프로세스](../../../../../../docs/social-login-process.md)를 따른다.

## Apple 로그인

먼저 본문 없이 `POST /auth/social/apple/start`를 호출한다. 빈 객체도 허용하며 입력 필드는 거부한다. 성공 응답은 201이다.

```json
{
  "loginAttemptId": "서버가 발급한 UUID",
  "nonce": "서버가 생성한 무작위 문자열",
  "expiresIn": 300
}
```

모바일은 `nonce`를 Apple 인증 요청에 그대로 전달하고 반환된 ID 토큰으로 기존 로그인 API를 호출한다.

```json
{
  "provider": "apple",
  "credential": "APPLE_ID_TOKEN",
  "loginAttemptId": "시작 응답의 UUID"
}
```

서버는 고정 `https://appleid.apple.com/auth/keys`의 공개 키로 RS256 서명, issuer, 설정된 audience, exp, sub·nonce를 검증한다.
검증된 토큰의 nonce 해시가 DB의 로그인 시도와 일치하고 5분 만료 전이며 미사용일 때만 원자적으로 소비한다. 클라이언트가 nonce나 subject를 추가로 제출할 수 없다.
회원 식별은 `(apple, sub)`이며 Apple 이메일·이름은 수집하거나 자동 계정 통합에 사용하지 않는다.
`APPLE_CLIENT_IDS`는 쉼표로 구분한 공백 없는 허용 목록이다. iOS Bundle ID 및 웹/Android Services ID 중 실제 사용 중인 값만 등록한다. 누락·빈 항목은 모듈 구성을 거부한다.
JWKS 조회는 5초 제한·redirect 거부·캐시·키 교체를 적용한다. 잘못된 토큰·불일치·만료·재사용은 401, 공개 키 통신 장애·비정상 응답은 503이다.
시도는 회원·세션 처리 전에 소비된다. 로그인 응답 유실이나 이후 DB 실패 시 같은 요청을 재전송하지 말고 새 시도로 재시작한다. 서비스 토큰 발급 성공 응답은 위 제공자와 같은 200 형식이다.
DB에는 nonce 원문과 Apple ID 토큰을 저장하지 않는다. 만료·사용 완료 행의 자동 삭제 작업은 아직 없으므로 운영 시 만료 행 정리 정책을 구성한다.
Apple code 교환·제공자 refresh/revoke는 구현하지 않았다. 서비스의 refresh token은 Apple refresh token과 별개다.

## 로그인 성공 응답

```json
{
  "user": {
    "id": "회원 UUID"
  },
  "accessToken": "서비스 Access Token",
  "refreshToken": "서비스 Refresh Token",
  "tokenType": "Bearer",
  "expiresIn": 900
}
```

인증 실패는 401과 `SOCIAL_AUTHENTICATION_FAILED` 코드를 반환한다.
요청 검증 실패는 400과 `BAD_REQUEST`를 반환하며 details에 검증 메시지를 포함한다.
예상하지 못한 오류는 공통 필터가 내부 내용을 숨긴 500 응답으로 처리한다.
카카오 일시 장애·통신 실패·타임아웃·잘못된 외부 응답은 503과 `INTERNAL_SERVER_ERROR`를 반환한다.
유효하지 않은 토큰의 401과 구분하며, 인증 실패·외부 장애 시 회원 조회·생성과 서비스 세션 발급을 진행하지 않는다.

Access Token은 15분, 로그인 세션은 30일간 유효하다. Refresh Token은 32바이트 무작위 값이며 DB에는 SHA-256 해시만 저장한다.
세션 저장이 완료된 뒤 응답한다. 로그인마다 새 세션을 생성해 여러 기기를 지원한다.

## 토큰 갱신과 로그아웃

`POST /auth/token/refresh`, `POST /auth/logout`은 다음 본문을 받는다.

```json
{ "refreshToken": "서비스 Refresh Token" }
```

갱신 성공은 200과 새 accessToken, refreshToken, tokenType, expiresIn을 반환한다.
기존 Refresh Token은 사용 완료로 표시하고 같은 세션에 새 해시를 저장한다. 세션의 30일 만료 시점은 연장하지 않는다.
만료·폐기·알 수 없는 토큰은 401 / INVALID_REFRESH_TOKEN으로 응답한다.
사용한 토큰을 다시 제출하면 해당 세션을 폐기한다. 갱신 요청은 앱에서 하나씩 실행하고 성공 후 새 Refresh Token으로 교체해야 한다.

로그아웃은 해당 세션을 폐기하고 빈 204 응답을 반환한다. 이미 폐기했거나 알 수 없는 토큰이어도 204를 반환한다.
다른 기기의 세션은 유지한다. 이미 발급한 Access Token은 최대 15분의 남은 만료 시간까지 유효하다.

## 인증된 회원 확인

`GET /auth/me`는 `Authorization: Bearer <서비스 Access Token>`을 요구한다. 로그인 또는 갱신에서 받은 서비스 토큰을 사용하며 제공자 토큰·Refresh Token은 사용할 수 없다.

성공200은 `{ "user": { "id": "검증된 서비스 회원 ID" } }`이며 `Cache-Control: no-store`를 적용한다. 회원 ID는 JWT의 검증된 sub에서만 가져오며 query/body의 userId·subject를 신뢰하지 않는다. 토큰을 응답에 포함하지 않는다.

헤더 누락·형식 오류는401 `AUTHENTICATION_REQUIRED`, 잘못된·만료된 서비스 JWT는401 `INVALID_ACCESS_TOKEN`이며 `WWW-Authenticate: Bearer`를 제공한다. 검증 시스템 오류는 원문을 숨긴500 `INTERNAL_SERVER_ERROR`다.

현재 API는 JWT 검증과 DB 회원 존재를 확인한다. 탈퇴한 회원의 기존 JWT는 401 INVALID_ACCESS_TOKEN이다. 권한이나 세션 폐기는 조회하지 않으므로 일반 로그아웃 직후 이미 발급된 Access Token은 만료까지 유효하다. 갱신 후 회원ID를 확인할 때 새 Access Token으로 이 API를 호출한다.

## 회원 탈퇴

`DELETE /users/me`, 서비스 Bearer 필수. JWT의 회원만 즉시 삭제하고 빈204를 반환한다. 요청 body/query의 회원 ID를 사용하지 않는다. 회원·소셜 연결·모든 기기 세션/Refresh Token·회원에 묶인 Apple/Naver 연동 시도를 DB 트랜잭션과 FK cascade로 삭제한다. 이후 모든 기존 Access Token과 Refresh Token을 사용할 수 없다. 탈퇴 전에 이미 인증을 통과한 요청을 취소하는 기능은 없다.

탈퇴 유예/복구는 없으며 같은 소셜 계정으로 다시 로그인하면 새 회원 ID로 가입한다. 현재 DB에는 SavedItem/Asset/Subscription 모델이 없으므로 이 API가 저장 콘텐츠·결제 구독을 정리한다고 해석하지 않는다. 해당 도메인 도입 시 탈퇴 정책과 정리 구현을 반드시 확장한다. 제공자 계정 삭제나 외부 revoke는 수행하지 않는다.

## 연결된 소셜 계정 조회

`GET /users/me/social-accounts`, 서비스 Bearer 필수.200 `{ "socialAccounts": [{ "id": "소셜 연결 UUID", "provider": "naver", "linkedAt": "ISO8601 시각" }] }`. 본인 계정만 연결 시각/ID 순으로 반환하고 `Cache-Control: no-store`를 적용한다. subject·제공자 토큰·이메일은 반환하지 않는다.

## 로그인 회원에게 소셜 계정 연동

`POST /users/me/social-accounts`, 서비스 Bearer 필수. 입력 구조는 공통 로그인과 동일하며 네 제공자를 지원한다.200은 연결된 계정의 `{id, provider, linkedAt}`이다. 현재 회원에게 검증된 소셜 계정을 추가하고 새 회원이나 서비스 세션을 만들지 않는다. 연동된 제공자로 이후 로그인하면 동일 회원 ID를 사용한다.

- Google/Kakao: provider와 credential을 제출한다. 제공자 토큰을 서버가 검증한다.
- Apple: 먼저 `POST /users/me/social-accounts/apple/start`로 본인에 묶인 시도 ID/nonce를 생성한다. nonce로 Apple 인증을 진행하고 provider/credential/loginAttemptId를 연동 API에 제출한다.
- Naver: 먼저 `POST /users/me/social-accounts/naver/start`로 본인에 묶인 ID/attemptSecret/authorizationUrl을 받는다. 브라우저 로그인과 기존 `/auth/social/naver/callback`을 거친 뒤 provider/loginAttemptId/attemptSecret을 연동 API에 제출한다.
- 두 연동 시작 API는 body 없음 또는{}만 허용하고201을 반환한다.5분 만료·일회 소비·no-store 정책을 적용한다.
- Apple/Naver 시도는 시작한 회원과 연동 목적에 묶인다. 일반 로그인 시도를 연동에 쓰거나 연동 시도를 일반 로그인에 쓸 수 없다. 타 회원 시도를 소비하지 못하며 실패한 소유자/목적 확인은 시도를 소비하지 않는다.
- 회원당 제공자별1개. 동일 본인 계정은 새 유효 인증 증거로 재요청하면 기존 연결200. 같은 일회용 시도 재전송은401이며 새 시작이 필요하다.
- 이미 타 회원에게 연결된 계정 또는 본인의 동일 제공자 다른 계정은409 `SOCIAL_ACCOUNT_CONFLICT`. 기존 연결·회원·데이터를 변경하지 않는다. 자동 병합/교체/연동 해제 없음.
- 인증 누락·탈퇴 JWT는401, 잘못된 입력400, 제공자 인증 실패401 `SOCIAL_AUTHENTICATION_FAILED`, 외부 장애503, 내부 오류500. 다른 회원의 존재나 subject는 오류 응답에 포함하지 않는다.

### 마이그레이션 적용

연동 기능 사용 전에 `20261003073000_user_social_account_link`를 배포한다. 회원/제공자 유일 제약과 시도 ownerUserId FK를 추가하며 기존 행 삭제·계정 통합은 하지 않는다. 기존 `(userId, provider)` 중복이 있으면 migration은 실패하므로 사전에 중복을 점검하고 별도 정책을 정한다. 기존 로그인 시도의 ownerUserId는NULL이고 연동 시도는 회원 ID다. 이 nullable owner가 시도의 로그인/연동 목적을 구분한다.

## 인증 요청 제한

로그인·Apple/Naver start·Naver callback은 IP별 공유 60초 20회, refresh와 logout은 각각 IP별 60회, 연동·연동 start는 IP별 및 회원별 각각 공유 10회다. 허용 횟수 초과 시 `429 / RATE_LIMIT_EXCEEDED`와 `Retry-After` 헤더(초)를 반환한다. 첫 요청 기준 60초 창이며 실패도 소비하고 차단 요청은 만료를 연장하지 않는다. IP 검사, 인증, 회원 검사 순으로 실행한다. 공유 PostgreSQL 카운터 장애는 500이며 제한을 우회하지 않는다. 읽기·탈퇴 경로는 이번 제한 대상이 아니다.
