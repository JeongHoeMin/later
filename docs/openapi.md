# Swagger / OpenAPI 조회

API 서버가 실행 중이면 다음 GET 경로를 인증 없이 조회할 수 있다.

| 경로       | 응답              | 용도                                   |
| ---------- | ----------------- | -------------------------------------- |
| /docs      | Swagger UI (HTML) | 브라우저에서 API 읽기·요청 실행        |
| /docs-json | OpenAPI 3 JSON    | 모바일 개발자가 API 계약을 가져와 읽기 |

```sh
curl http://localhost:3000/docs-json
```

실제 서버 주소는 실행 환경에 맞게 바꾼다. 휴대전화의 localhost는 휴대전화 자신이므로 개발 PC의 접근 가능한 주소를 사용한다.

문서는 현재 등록된 Nest 컨트롤러와 Swagger 메타데이터에서 서버 실행 시 자동 생성한다. 코드를 변경하면 서버를 재시작하거나 개발 서버 재빌드를 완료한 뒤 다시 GET으로 읽는다. 별도의 정적 JSON 파일을 수동 동기화하지 않는다.
Swagger UI와 JSON은 같은 문서를 사용한다. API 계약 변경 시 컨트롤러의 요청·응답 메타데이터와 문서 계약 테스트를 함께 갱신한다. 문서에 실제 인증 토큰·환경 비밀값을 넣지 않는다.

Bearer 보안 스키마는 서비스 JWT를 의미한다. 각 API에 표시된 인증 요구사항을 따른다. 문서 조회 자체는 공개이며 서버 접근이 가능한 환경에서 사용할 수 있다. 이 설정은 서버 배포나 외부 네트워크 공개를 수행하지 않는다.

[Nest 공식 Swagger 설정](https://docs.nestjs.com/openapi/introduction)

## 인증 API 계약

POST /auth/social/login의 oneOf는 Google/Kakao/Naver/Apple 4개다. Apple에는 loginAttemptId가 필수다. 네이버는 별도 서버 시작·콜백 이후 공통 로그인 흐름이며 기존 직접 code/state 제출은 거부한다. 메타데이터에는 추가 필드 금지, 입력·성공·공통 오류 응답이 포함된다.

| API                             | 성공                         | 입력                                                                                         |
| ------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------- |
| POST /auth/social/login         | 200 회원·서비스 토큰         | Google/Kakao credential, Apple credential/loginAttemptId, Naver loginAttemptId/attemptSecret |
| POST /auth/social/apple/start   | 201 ID·nonce·300초           | 본문 없음/빈 객체                                                                            |
| POST /auth/social/naver/start   | 201 ID·비밀값·인가 URL·300초 | 본문 없음/빈 객체                                                                            |
| GET /auth/social/naver/callback | 303 고정 앱 URI              | 네이버 code/state 또는 error/state                                                           |
| POST /auth/token/refresh        | 200 새 토큰                  | refreshToken                                                                                 |
| POST /auth/logout               | 204 빈 응답                  | refreshToken                                                                                 |
| GET /auth/me                    | 200 회원 ID                  | Authorization: Bearer 서비스 Access Token                                                    |

/auth/me는 위 표에서 서비스 Bearer가 필요하다. 아래 회원 계정 API도 모두 서비스 Bearer가 필수다. 네이버 Callback은 브라우저가 호출하는 경로이며 앱이 직접 호출하지 않는다. 303 Location에는 시도 ID만 있다. /docs-json에서 네이버 경로가 보이지 않으면 최신 서버 재시작/배포 여부를 확인한다. 문서 조회 기능 자체는 서버 배포를 수행하지 않는다.

[로그인 프로세스](social-login-process.md), [HTTP 계약](../apps/api/src/auth/presentation/http/README.md)을 참고한다.

## 회원 계정 API 계약

| API                                        | 성공                              | 입력                                      |
| ------------------------------------------ | --------------------------------- | ----------------------------------------- |
| DELETE /users/me                           | 204 빈 응답                       | 서비스 Bearer, 본인 즉시 탈퇴             |
| GET /users/me/social-accounts              | 200 socialAccounts 목록           | 서비스 Bearer                             |
| POST /users/me/social-accounts             | 200 id/provider/linkedAt          | 서비스 Bearer + 제공자별 인증 입력 oneOf4 |
| POST /users/me/social-accounts/apple/start | 201 시도 ID·nonce·300초           | 서비스 Bearer, body 없음/{}               |
| POST /users/me/social-accounts/naver/start | 201 시도 ID·비밀값·인가 URL·300초 | 서비스 Bearer, body 없음/{}               |

연동 충돌은409 SOCIAL_ACCOUNT_CONFLICT이며 계정을 병합하지 않는다. 시작 시도는 현재 회원과 연동 목적에 묶이며 일반 로그인 시도와 혼용되지 않는다. Naver callback은 기존 공개 경로를 재사용한다. JWT Guard는 회원 존재도 확인해 탈퇴한 회원의 토큰을 거부한다. 일반 로그아웃의 Access Token은 만료까지 유효하다.
