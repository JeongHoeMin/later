# Requirement

## R1 · 운영 점검

- AC-R1-1: 현재 auth 코드의 비용/용량/장애/정책/설정 위험을 실제 파일과 대조하고 확인된 동작·조건부 영향·배포 미확인을 구분한다.
- AC-R1-2: docs/auth-operational-review.md에 우선순위, 재현 조건, 근거, 대응 권고와 이번 Redis 전환으로 해결한 항목을 기록한다. 추측 가격이나 측정하지 않은 성능을 단정하지 않는다.

## Out of Scope

Redis 전환 외 기능 수정, 운영 DB·배포·모바일.

## Service Policy Impact

점검은 정책 변경 없음. Redis 승인에 따른 정책 변경은 별도 Task에서 갱신한다.
