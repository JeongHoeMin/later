# Progress

## Approval
2026-10-03 사용자가 이전 완료 보고의 “만료 인증 데이터 정리” 제안에 “진행해”로 승인했다. 별도 기능 Task로 진행하며 서버만 변경한다. 사용자 pnpm-workspace.yaml 변경을 보존한다.

## Design
기존 인증 저장소 흐름을 확장하는 bounded 작업이다. expiresAt <= now만 삭제하며 재사용 탐지용 토큰은 세션 만료까지 보존한다. 1시간마다 테이블별 최대 500개, DB SKIP LOCKED와 프로세스 내 중복 방지로 실행한다. 새 제품 의존성은 추가하지 않는다.

## Result
만료 시도와 세션을 테이블별 최대 500개씩 삭제하는 저장소와 1시간 주기 scheduler를 AuthModule에 등록했다. 유효한 폐기 세션과 사용 완료 토큰을 보존해 재사용 탐지를 유지한다. 동일 트랜잭션과 SKIP LOCKED로 여러 서버의 동시 실행을 보호한다. 원문 오류 대신 집계/이벤트만 기록한다.

전체 API 테스트 440개, 타입·변경 lint·build·diff 검증 통과. 독립 리뷰에서 중요 결함 없음. 격리 테스트 DB와 직접 생성한 .env.test는 검증 후 정리한다. pnpm-workspace.yaml 사용자 변경은 커밋에서 제외한다. 개발/운영 DB와 모바일은 수정하지 않는다.

## Decision / Reason
작업별 새 외부 scheduler 의존성을 추가하지 않고 Nest lifecycle과 native timer를 사용한다. 유효한 세션의 토큰 단독 삭제는 재사용 탐지를 약화하므로 하지 않는다. 처리량은 테이블별 시간당 500개이며 이를 넘는 만료 유입량은 별도 조정이 필요하다.

## Next Proposal
인증 API 요청 제한을 별도 Task로 제안한다. 승인 전 구현하지 않는다.
