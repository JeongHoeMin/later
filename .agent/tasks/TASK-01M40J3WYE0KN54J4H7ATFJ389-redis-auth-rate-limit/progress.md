# Progress

## Approval

사용자가 운영 중 문제가 될 auth 구현과 비용을 찾아보라고 요청했고, Redis가 적합하거나 앞으로 필요하면 구성에 추가하도록 승인했다. Redis 공유 제한 전환과 점검 문서를 별도 Task로 진행한다. 사용자 pnpm-workspace.yaml 변경 보존, 서버만 변경.

## Decisions

PostgreSQL 카운터의 차단 요청에도 쓰기/잠금 발생 및 만료 카운터 정리 용량 문제를 확인했다. Redis는 이 경로의 공유 카운터와 TTL에만 사용한다. 다른 발견은 수정 승인 없이 점검 결과로 기록한다.

## Implementation and Decisions

공유 카운터를 Redis Lua/60초 TTL로 전환했다. 초과 요청은 조회만 하며 기존 숫자·429·Retry-After를 유지한다. 기존 PostgreSQL migration/table은 보존했다. Redis URL 필수, 초기5초/명령1초 제한과 장애 시 우회 없는 실패, 재연결을 구현했다. node-redis AbortSignal만으로 전송 후 명령을 제한하지 못하는 실제 지연 테스트 실패를 확인하여 명시 deadline과 연결 종료/복구를 추가했다.

리뷰에서 서버 전체 CLIENT PAUSE가 다른 DB 연결에도 영향을 준다는 지적을 반영해 테스트 전용 TCP 프록시로 교체했다. 재리뷰에서 잔여 중대한 결함 없음. 단위 AuthModule 테스트는 외부 Redis 포트를 테스트 저장소로 대체했다. pnpm 추가로 섞인 무관한 mobile lock 변경은 제거하고 API 의존성만 유지했다. 사용자 pnpm-workspace.yaml 변경은 보존했다.

## Verification and Policy

Unit295/E2E141/Integration56(실제 Redis9 포함) 모두 PASS. tsc·변경 TS eslint·build·Compose config·47개 로컬 문서 링크·diff 검증 PASS. pnpm 실행은 자동 dependency 재설치를 막는 --config.verify-deps-before-run=false 옵션 사용. docs/service-policy.md의 저장소·TTL·장애·재시작 정책과 README/project 지침을 코드와 대조했다.
Docker 데몬 미실행으로 컨테이너 실행은 미검증. 공식 Redis8.2.1 소스를 임시 경로에서 빌드한 실제 localhost 서버와 격리 later_test로 검증했다. 실제 설정64MB/noeviction/RDB·AOF 비활성 확인. 실제 OOM 부하 및 연결 timeout2초의 직접 재현은 하지 않았다. 운영 배포 없음.

## Next Proposal

Redis 앞단 전체 요청 제한과 readiness/지표는 운영 설정 확인 후 별도 승인 범위로 진행한다.
