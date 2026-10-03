# Progress

## Approval

사용자가 만료 데이터 정리와 인덱스 개선 제안에 진행하라고 승인했다. 기능별 Task로 분리한다. 현재 feat/auth 및 사용자 workspace 변경을 보존한다.

## Design

API 내부 스케줄러를 유지하며 bounded 반복으로 처리량을 개선한다. 외부 worker 도입은 하지 않는다. 인덱스는 기존 데이터를 삭제하지 않는 추가 migration으로 검증한다.

## Completed

AuthSession(expiresAt,id), AppleLoginAttempt(ownerUserId), NaverLoginAttempt(ownerUserId) 인덱스와 추가 migration을 구현했다. 데이터 삭제/필드 변경 없음. 격리 later_test에만 적용했다.

## Decisions and Verification Limits

작은 테스트 테이블에서는 planner가 순차 조회를 선택할 수 있어 테스트 transaction 안에서 enable_seqscan=off를 설정해 실제 쿼리의 인덱스 사용 가능성을 검증했다. 운영 비용/실행 시간 개선의 실측은 아니다. 일반 CREATE INDEX는 생성 중 쓰기를 막을 수 있어 운영 적용 작업 시간/데이터량 검토가 필요하다. 개발·운영 DB에 적용하지 않았다.

## Service Policy / Architecture Update

사용자 정책 변경 없음. service-policy 적용 상태에 인덱스 migration 검증/운영 미적용을 기록하고 service-architecture의 저장소 조회 역할과 운영 점검의 완료 상태를 갱신했다.

## Final Verification

Unit299/E2E141/Integration60(실제 PostgreSQL/Redis) 총500개 PASS. tsc·변경 TS7개 eslint·build·Prisma validate PASS. 독립 리뷰와 문서 링크/YAML/diff 검증 완료. pnpm 자동 의존성 재설치를 방지하는 --config.verify-deps-before-run=false 옵션 사용. 사용자 pnpm-workspace.yaml 변경을 보존하고 모바일 수정/운영 배포 없음.

## Next Proposal

프록시 mapped 전체범위 설정 검증과 Google 통신 제한은 별도 승인 후 기능별 Task로 진행한다.
