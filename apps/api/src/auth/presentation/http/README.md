# 소셜 로그인 HTTP API

`POST /auth/social/login`

구글·Apple ID 토큰, 카카오 Access Token, 네이버 인가 코드를 지원한다. 같은 경로에서 기존 회원을 조회하거나 신규 회원을 생성한다.
모바일 로그인 과정과 state/nonce 책임은 [로그인 프로세스](../../../../../../docs/social-login-process.md)를 참고한다.

```json
{
  "provider": "google",
  "credential": "GOOGLE_ID_TOKEN"
}
```

- provider는 `google`, `kakao`, `naver` 또는 `apple`이어야 한다.
- credential은 비어 있지 않은 문자열이어야 한다.
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

네이버 요청:

```json
{
  "provider": "naver",
  "credential": "NAVER_AUTHORIZATION_CODE",
  "state": "CLIENT_VALIDATED_STATE"
}
```

서버는 NAVER_CLIENT_ID·NAVER_CLIENT_SECRET으로 인가 코드를 교환하고 Bearer 토큰으로 프로필을 조회한다.
성공 resultcode=00과 문자열 response.id를 확인하고 ID만 회원 연결에 사용한다. 네이버 토큰은 저장·반환하지 않는다.
설정 누락·공백 값은 모듈 구성 시 거부한다. 외부 요청은 각각 5초 제한이며 redirect를 따라가지 않는다.
네이버 요청에만 state가 필수다. 서버는 state의 형식만 확인하고 교환 요청에 전달한다.
모바일은 원래 로그인 시도와 state를 대조하고 만료·중복 콜백을 차단한 뒤 호출해야 한다.
현재 서버에는 state를 발급하거나 원래 값과 대조하는 기능이 없다.
네이버 인증 실패는 401, 외부 장애·통신·timeout·비정상 응답은 공통 503이며 실패 시 회원·세션을 처리하지 않는다.

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
