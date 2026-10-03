# Verification

## T-R1-1 · 현재 정책 대조
AC-R1-1,2 / MANUAL / PASS. docs/service-policy.md를 회원/소셜 저장소·로그인/연동 유스케이스·JWT/Guard·세션 발급/회전/로그아웃·탈퇴 cascade·정리·제한 정책과 대조했다. Access15분, 세션30일(연장없음), Apple/Naver5분, 제공자별1연결, 20/60/10회 제한, 즉시 탈퇴·재가입 새ID·외부 revoke미구현 등을 확인했다. 운영 배포 완료나 콘텐츠/결제 데이터 삭제 정책을 주장하지 않는다.

기존 social-login-process.md의 회원 DB 존재 확인 및 자동 정리 미구현 설명을 현재 동작으로 수정했다. HTTP/정리 README는 동일 기준 문서에 연결했다. 서비스 정책 기준 파일은 요청 제한 구현 커밋에도 포함해 코드와 같이 검증한다.

## T-R2-1 · 향후 갱신 지침
AC-R2-1 / MANUAL / PASS. .agent/AGENTS.md와 project.md에 정책 포함 구현 시 docs/service-policy.md의 같은 항목을 항상 갱신하고 코드와 대조하는 규칙을 추가했다. 완료 전 갱신·검증을 요구하고 정책 영향이 없는 작업은 해당 없음을 기록한다. requirement/progress/verification 템플릿에 정책 영향·갱신·검증 항목과 링크를 추가했다.

RED/GREEN/REFACTOR: N/A (문서/지침 전용, 동작 테스트를 억지로 만들지 않음).

## Final Verification
문서 로컬 상대 링크46개 모두 존재 확인. 지침·Task 네 문서·템플릿 링크와 상태 대조, git diff --check PASS. 독립 리뷰에서 정책 문서/지침의 중요 결함 없음. 관련 구현 최종 Unit287/E2E141/Integration47·tsc·lint·build PASS. Task title/status/next_action 대조 완료.
