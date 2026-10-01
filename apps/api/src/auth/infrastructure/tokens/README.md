# Access Token

`AccessTokenModule`을 소비자 모듈에서 import하면 토큰 발급·검증 포트와 `AccessTokenGuard`를 사용할 수 있다.
AuthModule은 이 모듈을 사용하며, 로그인 성공 시 Access Token과 Refresh Token을 발급한다.

## 설정

`ACCESS_TOKEN_SECRET`에는 최소 32바이트의 무작위 비밀키를 설정한다. 저장소에 커밋하지 않는다.

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

모듈 구성 시 키가 없거나 짧으면 오류가 발생한다.
현재 HS256, issuer `later-api`, audience `later-mobile`, typ `at+jwt`를 사용하며 15분 후 만료된다.
발급 시간, 만료 시간, 회원 ID는 필수다. 인증 결과는 `{ userId }`이고 회원 ID는 검증된 sub에서 가져온다.

## HTTP 인증

보호할 라우터에 `@UseGuards(AccessTokenGuard)`를 명시하고,
클라이언트는 `Authorization: Bearer <accessToken>`을 보낸다.
검증 성공 시 `request.user`에 인증된 회원 ID가 저장된다.

- 누락 또는 잘못된 헤더: 401 / `AUTHENTICATION_REQUIRED`
- 유효하지 않은 토큰: 401 / `INVALID_ACCESS_TOKEN`
- 예상하지 못한 검증 시스템 오류: 공통 필터의 500 처리

이 Guard는 토큰의 유효성을 검사한다. 회원 탈퇴 여부, 역할에 따른 권한, 로그인 세션 폐기 여부는 조회하지 않는다.
