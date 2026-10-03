# Requirement

## R1 · bounded 정리

- AC-R1-1: 시작 즉시·이후5분마다 실행하고 진행 중 중복과 종료 후 재실행을 방지한다.
- AC-R1-2: 동일 cutoff로 배치500개를 최대10회 반복한다. 모든 테이블이500미만이면 종료하며 배치 사이10초 예산을 확인한다. 진행 중 DB 작업을 무리하게 취소하지 않는다.
- AC-R1-3: 집계에 배치 수와 상한 도달 여부를 포함한다. 오류 시 이후 주기 재시도, 이전 성공 배치는 유지한다. 세션 만료/재사용 탐지 보존 정책은 유지한다.

## Service Policy Impact

정리 Task는 물리 삭제 주기/처리량을 service-policy.md에 갱신한다. 인덱스는 사용자 정책 변경 없음.

## Service Architecture Impact

service-architecture.md와 운영 점검에 현재 정리 구성 및 인덱스 근거를 갱신한다.

## Out of Scope

운영 DB/배포·모바일·프록시/Google 문제 수정·세션 상한 정책.
