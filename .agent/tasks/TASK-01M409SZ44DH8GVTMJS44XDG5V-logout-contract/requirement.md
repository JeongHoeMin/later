# Requirement

## R1 · 해당 세션 로그아웃

- AC-R1-1: POST /auth/logout은 Refresh Token의 해시로 해당 세션만 폐기하고 빈 204를 반환한다.
- AC-R1-2: 반복 요청과 알 수 없는 토큰도 204다. 폐기된 세션의 갱신은 401이며 다른 기기는 유지한다.
- AC-R1-3: 기존 JWT의 남은 유효 시간과 입력 400·저장소 장애 500 계약을 유지한다.

## Out of Scope

전체 기기 로그아웃, JWT 세션 조회, 외부 제공자 revoke, 모바일.
