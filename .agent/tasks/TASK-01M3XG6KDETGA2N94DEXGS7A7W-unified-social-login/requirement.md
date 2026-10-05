# Requirement
## R1
- AC-R1-1: 공통 POST /auth/social/login은 naver provider와 loginAttemptId/attemptSecret으로 기존 Flow 완료 검증과 토큰 발급을 수행한다.
- AC-R1-2: 기존 /naver/complete 제거(404), code/state 직접 제출과 혼합/추가 필드 거부(400). 시작/콜백과 다른 제공자 보호 유지.
- AC-R1-3: Swagger 네 제공자 oneOf 및 문서 최신화.
## Out of Scope
모바일, 배포, DB 변경.
