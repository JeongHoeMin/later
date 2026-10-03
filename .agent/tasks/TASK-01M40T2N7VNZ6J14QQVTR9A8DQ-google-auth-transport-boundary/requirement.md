# Requirement

## R1

- AC-R1-1: Google 인증서 HTTP는5초 timeout, 자동 retry0으로 동작하며 SDK 인증서 cache와 실제 JWT 검증을 유지한다.
- AC-R1-2: 인증서 통신/HTTP/잘못된 응답은 SocialAuthenticationUnavailableError로503; 잘못된 JWT/서명/claims/subject는 기존401. 회원/세션/연동 저장 전에 실패하고 원문/토큰 비노출.
- AC-R1-3: 기본 provider와 Nest OAuth2Client DI 모두 제한된 client를 사용한다. 캐시 적중은 추가 통신 없음. 외부 Google 실제 계정 호출 없이 SDK+HTTP경계 테스트로 검증한다.

## Service Policy Impact

[서비스 정책](../../../docs/service-policy.md)에 프록시 범위 거부 또는 Google5초·재시도0·401/503 조건을 갱신한다.

## Service Architecture Impact

[서비스 구성](../../../docs/service-architecture.md)에 해당 네트워크/외부 의존성 설정 역할을 갱신한다.

## Out of Scope

모바일·운영 배포·개발/운영 DB 변경·전역 제공자 동시성/circuit breaker·세션 정책 변경.
