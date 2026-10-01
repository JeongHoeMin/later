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
  }
}
```

인증 실패는 401과 `SOCIAL_AUTHENTICATION_FAILED` 코드를 반환한다.
요청 검증 실패는 400과 `BAD_REQUEST`를 반환하며 details에 검증 메시지를 포함한다.
예상하지 못한 오류는 공통 필터가 내부 내용을 숨긴 500 응답으로 처리한다.

현재 응답에는 서비스 토큰이나 세션이 포함되지 않는다. 로그인 상태 유지는 후속 작업에서 구현한다.
