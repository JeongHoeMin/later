# Requirement

## R1

- AC-R1-1: IPv6 CIDR이 mapped IPv4 전체 /96을 포함하면 문자열 표현과 host bit에 관계없이 시작 시 거부한다. 기존 IPv4/IPv6 /0 거부 유지.
- AC-R1-2: 전체 IPv4를 포함하지 않는 명시 IP/CIDR과 mapped 세부 CIDR은 유지한다. HTTP 신뢰 프록시와 IP 제한 회귀를 검증한다.

## Service Policy Impact

[서비스 정책](../../../docs/service-policy.md)에 프록시 범위 거부 또는 Google5초·재시도0·401/503 조건을 갱신한다.

## Service Architecture Impact

[서비스 구성](../../../docs/service-architecture.md)에 해당 네트워크/외부 의존성 설정 역할을 갱신한다.

## Out of Scope

모바일·운영 배포·개발/운영 DB 변경·전역 제공자 동시성/circuit breaker·세션 정책 변경.
