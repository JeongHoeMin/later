# 소셜 로그인 HTTP API

`POST /auth/social/login`

현재 구글 ID 토큰을 지원한다. 같은 경로에서 기존 회원을 조회하거나 신규 회원을 생성한다.

```json
{
  "provider": "google",
  "credential": "GOOGLE_ID_TOKEN"
}
```

- provider는 `google`이어야 한다.
- credential은 비어 있지 않은 문자열이어야 한다.
- 추가 필드와 잘못된 본문은 400으로 거부한다.
- 회원 식별에는 검증된 구글 토큰의 sub를 사용한다.

성공 응답은 기존 회원과 신규 회원 모두 200이다.

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
