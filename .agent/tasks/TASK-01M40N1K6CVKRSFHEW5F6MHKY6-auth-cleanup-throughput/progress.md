# Progress

## Approval

사용자가 만료 데이터 정리와 인덱스 개선 제안에 진행하라고 승인했다. 기능별 Task로 분리한다. 현재 feat/auth 및 사용자 workspace 변경을 보존한다.

## Design

API 내부 스케줄러를 유지하며 bounded 반복으로 처리량을 개선한다. 외부 worker 도입은 하지 않는다. 인덱스는 기존 데이터를 삭제하지 않는 추가 migration으로 검증한다.

## Completed

시작 즉시·5분 주기와 최대10배치(테이블별500개) 반복을 구현했다. 동일 cutoff·단조 시각의 배치 사이10초 예산을 적용하고 batches/limitReached를 로그에 추가했다. 각 배치 커밋을 유지하여 뒤 실패가 이전 성공을 취소하지 않는다. 진행 중 DB 작업을 취소하지 않아 엄격한10초 deadline은 아니다.

## Review and Corrections

독립 리뷰에서 즉시 scheduler가 DB 모듈 integration의 타 소유 만료 데이터를 삭제할 수 있음을 발견했다. 테스트 소유 sentinel로 Apple 모듈에서 기대 실패를 확인한 후 두 모듈 integration의 scheduler를 무동작 provider로 대체해 소유 데이터 보존을 검증했다. 재리뷰에서 잔여 P1/P2 없음.

## Service Policy / Architecture Update

service-policy.md의 정리 주기·상한·부분 커밋·로그·삭제 지연 조건 갱신. service-architecture.md의 내부 scheduler와 정리 흐름 갱신. cleanup README와 운영 점검의 이전/현재 상태 대조 완료.

## Remaining Risks

큰 세션의 cascade 자식 토큰 수는 부모 배치500개로 제한되지 않는다. 별도 backlog count/경보 및 세션/토큰 정책은 미구현 후속 과제다.

## Final Verification

Unit299/E2E141/Integration60(실제 PostgreSQL/Redis) 총500개 PASS. tsc·변경 TS7개 eslint·build·Prisma validate PASS. 독립 리뷰와 문서 링크/YAML/diff 검증 완료. pnpm 자동 의존성 재설치를 방지하는 --config.verify-deps-before-run=false 옵션 사용. 사용자 pnpm-workspace.yaml 변경을 보존하고 모바일 수정/운영 배포 없음.

## Next Proposal

프록시 mapped 전체범위 설정 검증과 Google 통신 제한은 별도 승인 후 기능별 Task로 진행한다.
