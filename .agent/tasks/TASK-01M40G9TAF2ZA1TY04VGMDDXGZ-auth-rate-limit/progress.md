# Progress

## Approval
2026-10-03 사용자가 권장대로 요청 제한을 진행하고 기존 서비스 정책을 docs에 정리하며 향후 갱신 지침을 추가하라고 승인했다. 기능별 Task 분리, 서버만 변경, pnpm-workspace.yaml 사용자 변경 보존.

## Design
기존 PostgreSQL을 공유 카운터로 사용해 새 운영 의존성을 피한다. class/method metadata를 읽는 IP Guard와 인증 후 회원 Guard를 사용한다. 첫 요청 기준 60초 창이다.

## Implementation / Decisions
PostgreSQL ON CONFLICT로 원자적 카운터를 공유한다. DB statement_timestamp를 기준으로 첫 요청부터60초 창을 만든다. 원본 식별자는 SHA-256 키로 변환하며 토큰은 입력으로 사용하지 않는다. 실패 요청도 소비하고 초과 횟수는 limit+1에서 포화한다. IP Guard를 인증 Guard보다 먼저 등록해 미인증 연동도 보호하고 인증 후 회원 Guard로 IP 변경 우회를 방지한다.

Redis를 새로 요구하는 대안은 현재 배포 구조에 근거가 없어 제외했다. 기본적으로 전달 헤더를 신뢰하지 않고 명시 IP/CIDR만 허용한다. 다른 도메인 전체 요청 제한은 이번 승인 범위 밖이다.

## Verification / Issues
전체 Unit287/E2E138/DB46 PASS. 기존 E2E 테스트 사이 공유 카운터 누적은 테스트 저장소별 초기화로 해결했다. 새 테스트는 실제 Guard와 Nest HTTP를 사용하고 외부 DB/제공자 경계만 대체한다. 실제 DB 테스트로 원자성도 별도 검증했다. 독립 리뷰 및 재리뷰 완료.

## Service Policy Update
docs/service-policy.md 요청 제한과 만료 카운터 정리 정책을 추가했다. API README와 정리 README에 정책 문서 링크를 추가한다. 문서 Task는 향후 갱신 지침과 기존 정책 정합성 점검을 별도로 관리한다.


## Review Fix / Final
서버 시계 차이 문제를 실제 DB에서 RED 후 수정했다. DB timezone Asia/Seoul에서 UTC 저장 필요성도 확인해 counter 생성/판정/Retry-After를 UTC로 통일하고 정리 cutoff를 DB 시간으로 제한했다. 독립 재리뷰에서 추가 중요 결함 없음.
최종 테스트475개, tsc·lint·build·Prisma validation/schema diff·문서 링크·diff PASS. 테스트 전용 PostgreSQL과 직접 생성한 .env.test를 종료/정리한다. 로컬 feat/auth 커밋만 수행하고 사용자 pnpm-workspace.yaml 변경을 제외한다.

## Next Proposal
실제 배포 환경의 프록시·소셜 제공자 설정 점검을 별도 작업으로 제안한다. 승인 전 운영 적용하지 않는다.
