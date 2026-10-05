# Progress

## Approval

사용자가 프록시 설정 우회 문제와 Google 통신 제한을 개선하라는 제안에 개선하라고 승인했다. 기능별 Task로 분리하고 기존 feat/auth 및 사용자 workspace 변경을 보존한다.

## Design

기존 구현에 한정한 개선이다. 설치 proxy-addr와 Google SDK/Gaxios 구현 및 공식 문서를 대조했다. 전체 mapped IPv4를 포함하는 IPv6 prefix 비교와 인증서 조회 경계의 timeout/retry/장애 분류를 검증한다. JWT 검증·SDK cache는 유지한다.

## Implementation

IPv6를 canonical128비트 값으로 변환하여 해당 prefix가 전체 mapped IPv4 /96을 포함하는지 확인한다. mapped 표현만 확인하는 대신 `::/1`, `::/80`, host bits가 포함된 표현도 차단한다. /97 이상의 세부 mapped 범위와 전체 IPv4를 포함하지 않는 IPv6는 기존대로 허용한다.

## Service Policy / Architecture Update

service-policy의 프록시 거부 조건·표현 우회 방지를 추가하고 ENV 예시·service-architecture·운영 점검의 수정 상태를 갱신했다. 실제 운영 프록시 설정은 미확인이다.

## Review and Verification

독립 리뷰에서 설치 SDK/Gaxios/proxy-addr 원문과 code 경계를 대조하여 P1/P2 없음. Unit325/E2E145/Integration60 총530개, tsc·변경 TS8개 eslint·build PASS. 테스트는 격리 localhost later_test/Redis DB15와 소셜 HTTP 경계 대체로 수행했다. 기존 mock E2E의 cleanup 실패 이벤트와 실제 Redis 장애 주입 로그는 Suite 실패와 구분한다. 사용자 pnpm-workspace.yaml 변경 보존. pnpm은 --config.verify-deps-before-run=false로 자동 의존성 재설치를 막았다.

## Next Proposal

전역 제공자 동시 대기 상한·정리 backlog/실패 경보·세션/토큰 누적 관측은 별도 승인 후 기능별 Task로 진행한다.
