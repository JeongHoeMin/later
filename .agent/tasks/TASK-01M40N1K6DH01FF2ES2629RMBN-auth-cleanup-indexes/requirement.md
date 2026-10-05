# Requirement

## R1 · 인덱스

- AC-R1-1: AuthSession(expiresAt,id), AppleLoginAttempt(ownerUserId), NaverLoginAttempt(ownerUserId) 인덱스와 비파괴 migration을 추가한다.
- AC-R1-2: 실제 later_test에서 migration 적용 전 기대 인덱스 누락을 확인하고 적용 후 카탈로그 및 EXPLAIN으로 사용 가능성을 검증한다. 운영 DB에 적용하지 않는다.

## Service Policy Impact

정리 Task는 물리 삭제 주기/처리량을 service-policy.md에 갱신한다. 인덱스는 사용자 정책 변경 없음.

## Service Architecture Impact

service-architecture.md와 운영 점검에 현재 정리 구성 및 인덱스 근거를 갱신한다.

## Out of Scope

운영 DB/배포·모바일·프록시/Google 문제 수정·세션 상한 정책.
