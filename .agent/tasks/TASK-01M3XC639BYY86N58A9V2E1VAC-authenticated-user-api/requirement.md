# Requirement

Goal: 서버 로그인/갱신으로 발급한 서비스 Access Token을 실제 회원 확인 API에 연결한다. 이 세션은 서버 전용이며 모바일 구현은 제외한다.

R1 AC-R1-1: GET /auth/me에 유효한 서비스 Bearer를 보내면 JWT의 검증된 sub에서 얻은 회원ID만 {user:{id}}로 반환한다. 입력으로 회원ID/subject를 신뢰하지 않는다. 응답에 토큰은 포함하지 않고 Cache-Control:no-store.
R1 AC-R1-2: 누락/잘못된 header는401 AUTHENTICATION_REQUIRED, 잘못된/만료된 JWT는401 INVALID_ACCESS_TOKEN. 기존 공통오류와 WWW-Authenticate 계약을 유지한다. 시스템 오류는 마스킹500.
R2 AC-R2-1: 실제 AppModule DI에서 제공하고 Swagger GET /docs-json에 bearer필수/200/401/500 및 응답schema를 표시한다. 기존 로그인·Apple시작·refresh·logout 공개 인증발급계약은 유지.

Out of scope: DB 회원 상태/프로필 조회, 탈퇴/권한/세션 폐기 즉시검사. 현재 Guard는 JWT 유효성만검사하므로 이 API는 인증된 회원ID 확인이다. 모바일 구현/SDK 제외.
