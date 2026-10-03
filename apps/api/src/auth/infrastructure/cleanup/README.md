# 만료 인증 데이터 정리

AuthModule이 등록하는 AuthCleanupScheduler는 API 시작 1시간 후부터 매시간 실행한다. 한 프로세스에서 이전 작업이 진행 중이면 해당 주기를 건너뛰며, 종료 시 timer를 해제하고 진행 중인 작업을 기다린다.

실행마다 동일한 기준 시각을 사용해 `expiresAt <= now`인 AppleLoginAttempt, NaverLoginAttempt, AuthSession, AuthRateLimitBucket을 각각 최대 500개 삭제한다. 만료 시각과 ID 순으로 선택하고 한 트랜잭션 안에서 `FOR UPDATE SKIP LOCKED`로 다른 실행이 잠근 행을 건너뛴다. RefreshToken은 세션 FK cascade로 삭제한다. 로그인·연동 시도 모두 같은 만료 규칙을 따른다.

유효한 세션은 폐기 여부와 관계없이 보존한다. 사용 완료 토큰도 세션 만료까지 유지해 Refresh Token 재사용 탐지가 계속 동작한다. User와 SocialAccount는 정리 대상이 아니다.

성공 로그는 삭제 건수, 실패 로그는 이벤트 이름만 기록한다. 실패하면 트랜잭션이 취소되고 다음 주기에 다시 실행한다. 기본 처리량은 테이블별 시간당 500개이므로 만료 데이터 유입이 이를 넘으면 처리량 조정이 필요하다. 서버가 실행 중일 때만 정리한다.

검증: scheduler.spec.ts의 fake timer 테스트와 prisma-auth-cleanup.repository.integration-spec.ts의 실제 PostgreSQL 경계·배치·잠금·동시 실행·토큰 재사용 테스트.

정책 기준: [서비스 정책](../../../../../../docs/service-policy.md#인증-데이터-정리와-응답-보안). 제한 카운터는 IP/회원 ID의 해시와 횟수만 저장하며 만료 후 같은 주기에 정리한다.

요청 제한 카운터는 DB UTC 시각과 실행 기준 시각 중 이른 값까지만 삭제한다. 서버 시계가 앞서도 DB에서 유효한 제한 창을 지우지 않는다.
