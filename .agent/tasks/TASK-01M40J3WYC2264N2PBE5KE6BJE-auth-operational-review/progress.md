# Progress

## Approval

사용자가 운영 중 문제가 될 auth 구현과 비용을 찾아보라고 요청했고, Redis가 적합하거나 앞으로 필요하면 구성에 추가하도록 승인했다. Redis 공유 제한 전환과 점검 문서를 별도 Task로 진행한다. 사용자 pnpm-workspace.yaml 변경 보존, 서버만 변경.

## Decisions

PostgreSQL 카운터의 차단 요청에도 쓰기/잠금 발생 및 만료 카운터 정리 용량 문제를 확인했다. Redis는 이 경로의 공유 카운터와 TTL에만 사용한다. 다른 발견은 수정 승인 없이 점검 결과로 기록한다.

## Result

[운영 점검 보고](../../../docs/auth-operational-review.md)에 정리 처리량, 누락 인덱스, 토큰 누적, proxy mapped 범위 우회, 제공자 지연, 배포 확인 사항을 기록했다. 비용 수치는 가정이며 실측 비용과 구분했다. DB/보안 독립 리뷰와 설치 라이브러리 확인, mapped CIDR probe로 근거를 대조했다. 서비스 정책 변경은 이 Task에 해당 없음.

## Next Proposal

정리 처리량 개선, 필요한 인덱스 추가, 프록시 설정 검증 보강을 각각 별도 Task로 승인받아 진행한다. 승인 전 구현하지 않는다.
