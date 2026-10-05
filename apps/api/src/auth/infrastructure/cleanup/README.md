# 만료 인증 데이터 정리

AuthModule의 AuthCleanupScheduler는 API 시작 시 즉시 실행하고 이후5분마다 실행한다. 진행 중이면 해당 주기를 건너뛰며 종료 시 timer를 해제하고 진행 중인 실행을 기다린다. 별도 worker나 큐는 없다.

한 실행의 동일한 기준 시각으로 `expiresAt <= now`인 AppleLoginAttempt, NaverLoginAttempt, AuthSession, 기존 AuthRateLimitBucket을 배치당 각각 최대500개 삭제한다. 만료 시각과 ID/키 순으로 선택하며 `FOR UPDATE SKIP LOCKED`로 잠긴 행을 건너뛴다. RefreshToken은 세션 FK cascade로 삭제한다. 각 배치는 별도 트랜잭션이므로 뒤 배치 실패가 앞 배치 커밋을 취소하지 않는다.

모든 테이블의 삭제 건수가500미만이면 이번 실행을 끝낸다. 한 테이블이라도 배치를 채우면 최대10배치까지 반복한다. 배치 사이에 단조 시각으로10초 예산을 확인한다. 진행 중 DB 작업은 취소하지 않으므로 전체 실행이10초를 넘을 수 있다. 잠금 때문에 건너뛴 행은 다음 주기에 처리한다. 최대 처리량은 조건부로 실행당 테이블별5,000개이며 실제 처리량/물리 삭제 완료 시간은 보장하지 않는다. 세션500개 삭제 시 cascade 토큰 수는500개로 제한되지 않는 위험이 남아 있다.

유효한 세션은 폐기 여부와 관계없이 보존하며 사용 완료 Refresh Token도 세션 만료까지 유지해 재사용 탐지를 보호한다. User와 SocialAccount는 정리 대상이 아니다.

성공 로그는 이벤트·삭제 건수·`batches`·`limitReached`를 기록한다. `limitReached`는 예산/배치 상한으로 반복을 멈췄다는 뜻이며 추가 행 존재를 확정하지 않는다. 실패 로그는 원문 없이 이벤트만 기록하고 다음5분 주기에 재시도한다. 운영에서는 연속 상한 도달·실패와 실제 만료 backlog를 함께 관측해야 한다. AuthOperationsMetrics가5분마다 정리 runs/failures/삭제 건수/배치 수/시간·연속 실패·연속 상한 도달을 집계 로그로 기록한다. 성공 실행의 삭제 건수만 집계하므로 실패 전 커밋된 배치의 삭제 건수는 해당 집계에 포함되지 않는다. 별도 backlog count/실제 경보 수집은 아직 없다.

AuthSession(expiresAt,id) 인덱스가 정리의 필터/정렬을 지원한다. Apple/Naver(ownerUserId) 인덱스는 탈퇴 시 연동 시도 FK 조회를 지원한다. 추가 migration의 일반 CREATE INDEX는 생성 중 쓰기를 막을 수 있어 운영 적용 시 별도 작업 계획이 필요하다.

이전 PostgreSQL 카운터는 DB UTC 시각과 실행 기준 중 이른 값까지만 정리한다. 새 Redis 카운터는60초 TTL로 자동 삭제되어 이 작업에 의존하지 않는다. 기존 migration/테이블은 보존한다.

검증: scheduler.spec.ts의 즉시/주기/중복/종료/실패 및 bounded 반복 테스트, prisma-auth-cleanup.repository.integration-spec.ts의 실제 PostgreSQL 경계·다중 배치·부분 성공·잠금·동시 실행·토큰 재사용 보존, auth-cleanup-indexes.integration-spec.ts의 카탈로그/EXPLAIN 검증.

정책 기준: [서비스 정책](../../../../../../docs/service-policy.md#인증-데이터-정리와-응답-보안). 구성: [서비스 구성](../../../../../../docs/service-architecture.md).
