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

전역 필터는 `5xx` 오류와 알 수 없는 오류의 상태 코드를 서버 로그에 기록하고,
응답 본문에는 `INTERNAL_SERVER_ERROR`와 일반적인 안내만 반환한다.
`503` 등 명시적인 HTTP 상태는 유지한다. 내부 메시지와 스택은 응답하지 않는다.
예외 원문의 메시지와 스택은 로그에도 넣지 않는다.

## 컨트롤러 요청 로그

AppModule의 `APP_INTERCEPTOR`로 `RequestLoggingInterceptor`를 전역 등록한다.
개별 컨트롤러에 데코레이터를 추가하지 않아도 HTTP 요청에 적용된다.

| event             | 수준  | 시점                                        |
| ----------------- | ----- | ------------------------------------------- |
| request.started   | log   | Guard 통과 후 컨트롤러/파이프 실행 전       |
| request.succeeded | log   | 최종 응답 종료, HTTP 상태 400 미만          |
| request.failed    | warn  | 최종 응답 4xx 또는 연결 중단                |
| request.failed    | error | 최종 응답 5xx                               |
| http.exception    | error | 기존 예외 필터의 5xx 진단, 상태 코드만 기록 |

진입과 종료에는 서버가 생성한 UUID `requestId`, HTTP `method`, `controller`, `handler`를 기록한다.
종료에는 실제 응답의 `statusCode`와 단조 시계로 측정한 `durationMs`가 추가된다.
요청 ID는 `X-Request-Id` 응답 헤더로 제공하고 클라이언트 입력 ID는 신뢰하지 않는다.
로그 객체는 Nest Logger 출력 설정에 따라 렌더링되며 별도 파일 저장·외부 수집기는 구성하지 않는다.

응답 finish/close를 기준으로 종료 로그를 한 번만 기록하므로 204·리다이렉트·직접 응답도 실제 상태를 사용한다.
연결 중단은 `reason: connection_closed`로 기록하며 완료되지 않은 HTTP 상태를 확정하지 않는다.
기존 응답 본문과 예외 처리 상태는 유지한다. 스트리밍 응답의 처리 시간은 스트림 연결 수명이다.

요청/응답 본문, 헤더, 실제 URL, query, 경로 파라미터, 예외 메시지·스택은 기록하지 않는다.
컨트롤러가 없는 404, 파서·middleware·Guard에서 인터셉터 진입 전에 거부된 요청,
Swagger가 Express에 직접 등록한 경로는 컨트롤러 로그 대상이 아니다.
필요하면 이러한 요청의 접근 로그를 별도 middleware/프록시 범위에서 설계한다.

전역 인터셉터 등록은 [Nest 공식 문서](https://docs.nestjs.com/interceptors)를 따른다.

검증: `pnpm test`, `pnpm test:e2e`, `pnpm build`, `pnpm exec tsc --noEmit --incremental false`.

필터 등록 방식은 [Nest 공식 문서](https://docs.nestjs.com/exception-filters)를 따른다.
