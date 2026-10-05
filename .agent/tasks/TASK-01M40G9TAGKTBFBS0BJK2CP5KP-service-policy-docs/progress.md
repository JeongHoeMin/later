# Progress

## Approval
2026-10-03 사용자가 권장대로 요청 제한을 진행하고 기존 서비스 정책을 docs에 정리하며 향후 갱신 지침을 추가하라고 승인했다. 기능별 Task 분리, 서버만 변경, pnpm-workspace.yaml 사용자 변경 보존.

## Design
단일 docs/service-policy.md를 현재 구현 정책의 기준 문서로 유지한다. 구현 없는 기획 내용은 추가하지 않는다. 문서 전용 TDD는 N/A이며 코드와 링크를 대조한다.


## Completed / Service Policy Update
docs/service-policy.md에 현재 구현한 회원 식별·제공자 로그인·일회용 시도·서비스 토큰/세션·로그아웃·탈퇴/재가입·소셜 조회/추가·요청 제한·만료 정리·오류/로그 보호·미지원과 운영 적용 범위를 정리했다. 사용자에게 영향을 주는 수치와 예외를 코드로 확인했다.

.agent/AGENTS.md, project.md, Task requirement/progress/verification 템플릿에 동일 문서를 앞으로 항상 갱신하는 규칙과 완료 전 확인 기준을 추가했다. 기존 social-login-process.md의 오래된 설명을 수정하고 기준 문서와 연결했다. API/정리 README 연결은 구현 Task 변경 세트에 포함한다.

## Verification / Decision
문서 전용이므로 TDD N/A, 코드/정책 대조와 로컬 링크46개·diff 검증 PASS. 독립 리뷰에서 중요 문서 결함 없음. 정책은 하나의 파일에 유지하고 상세 API/연동 문서는 링크로 연결한다. 미구현 기획을 확정 정책으로 적지 않는다. 운영 DB·모바일은 변경하지 않는다.

## Next Proposal
앞으로 정책 포함 작업마다 이 파일을 갱신한다. 다음 작업은 실제 배포 환경 설정 점검을 제안하며 승인 전 진행하지 않는다.
