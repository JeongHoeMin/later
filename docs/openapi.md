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

문서에는 provider별 로그인 입력 oneOf 4개, 필수 state/loginAttemptId, 추가 필드 금지, 공통 오류 본문, 서비스 토큰·Apple 시도 응답, refresh/logout 계약이 포함된다. 로그인 시작·토큰 발급·갱신·로그아웃은 서비스 Bearer를 요구하지 않는다. Swagger Authorize에는 필요할 때 Later 서비스 Access Token을 넣는다.

| API                           | 성공                       | 요청                                                   |
| ----------------------------- | -------------------------- | ------------------------------------------------------ |
| POST /auth/social/login       | 200 회원·서비스 토큰       | 제공자별 credential과 필요한 state 또는 loginAttemptId |
| POST /auth/social/apple/start | 201 시도 ID·nonce·유효기간 | 본문 없음 또는 빈 객체                                 |
| POST /auth/token/refresh      | 200 새 서비스 토큰         | refreshToken                                           |
| POST /auth/logout             | 204 본문 없음              | refreshToken                                           |
| GET /auth/me                  | 200 인증된 회원 ID         | Authorization: Bearer 서비스 Access Token              |

로그인·세션 상세 동작은 [로그인 프로세스](social-login-process.md)와 [HTTP 계약](../apps/api/src/auth/presentation/http/README.md)을 참고한다.
