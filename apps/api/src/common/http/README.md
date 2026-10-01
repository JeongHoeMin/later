# API 오류 응답

HTTP 상태 코드는 응답 상태에 유지하고, 오류 본문은 다음 형식을 사용한다.

```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "요청 값이 올바르지 않습니다.",
    "details": ["credential should not be empty"]
  }
}
```

- `code`: 클라이언트가 오류를 구분하는 문자열. 기본값은 HTTP 상태 이름이다.
- `message`: 사용자에게 표시할 오류 설명.
- `details`: 검증 메시지 목록이 있을 때만 포함한다.
- 성공 응답은 전역 필터가 변경하지 않는다.

도메인 오류는 각 HTTP 경계에서 Nest의 `HttpException`으로 변환한다.
필터는 도메인이나 저장소에 의존하지 않는다. 특정 오류 코드가 필요하면 다음처럼 지정한다.

```ts
throw new UnauthorizedException({
  code: 'SOCIAL_AUTHENTICATION_FAILED',
  message: '소셜 인증에 실패했습니다.',
});
```

전역 필터는 `5xx` 오류와 알 수 없는 오류를 서버 로그에 기록하고,
응답 본문에는 `INTERNAL_SERVER_ERROR`와 일반적인 안내만 반환한다.
`503` 등 명시적인 HTTP 상태는 유지한다. 내부 메시지와 스택은 응답하지 않는다.

검증: `pnpm test`, `pnpm test:e2e`, `pnpm build`, `pnpm exec tsc --noEmit --incremental false`.

필터 등록 방식은 [Nest 공식 문서](https://docs.nestjs.com/exception-filters)를 따른다.
