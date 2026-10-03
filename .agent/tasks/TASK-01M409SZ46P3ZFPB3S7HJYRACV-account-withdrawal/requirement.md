# Requirement

## R1 · 본인 즉시 탈퇴

- AC-R1-1: DELETE /users/me는 서비스 Bearer로 본인만 삭제하고 204를 반환한다. body/query의 회원 ID를 신뢰하지 않는다.
- AC-R1-2: 회원·소셜 연결·모든 기기 세션·Refresh Token을 원자 삭제하고 다른 회원을 보존한다. 연동 Task에서 도입한 회원 소유 시도도 삭제한다.
- AC-R1-3: Guard가 회원 존재를 확인해 모든 기존 JWT는 401 INVALID_ACCESS_TOKEN으로 거부한다. 회원 조회 장애는 500으로 닫는다. 기존 Refresh Token 갱신도 401이다.
- AC-R1-4: 같은 소셜로 재가입하면 새 회원 ID다. 저장소의 반복 삭제는 안전하며 삭제된 회원의 HTTP 재요청은 Guard가 401로 거부한다.

## Out of Scope

탈퇴 유예·복구, 외부 제공자 revoke, 현재 모델에 없는 콘텐츠·파일·결제 처리, 모바일. 탈퇴 전에 Guard를 통과한 진행 중 요청 취소 없음.
