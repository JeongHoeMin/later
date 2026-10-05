# Requirement

## R1 · 본인의 소셜 계정 목록

- AC-R1-1: GET /users/me/social-accounts는 JWT 본인의 연결만 반환한다. 입력 userId는 조회 기준이 아니다.
- AC-R1-2: 200 {socialAccounts:[{id,provider,linkedAt}]}와 no-store를 제공한다. 연결 시각·ID 순서이며 subject·이메일·토큰을 노출하지 않는다.
- AC-R1-3: 미인증·탈퇴 회원은 401, 저장소 장애는 500이다. Swagger에 Bearer와 성공·오류 계약을 제공한다.

## Out of Scope

타 회원 조회, 제공자 프로필 수집, 연동·해제(연동은 별도 Task), 모바일.
