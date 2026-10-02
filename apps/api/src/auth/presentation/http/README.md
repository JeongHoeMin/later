# 소셜 로그인 HTTP API

`POST /auth/social/login`

구글 ID 토큰, 카카오 Access Token, 네이버 인가 코드를 지원한다. 같은 경로에서 기존 회원을 조회하거나 신규 회원을 생성한다.
모바일 로그인 과정과 state/nonce 책임은 [로그인 프로세스](../../../../../../docs/social-login-process.md)를 참고한다.

```json
{
  "provider": "google",
  "credential": "GOOGLE_ID_TOKEN"
}
```

- provider는 `google`, `kakao` 또는 `naver`여야 한다.
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
