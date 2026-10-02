# Requirement

## Goal

모바일 개발자가 GET OpenAPI에서 실제 인증 API 입력·응답·오류를 정확히 읽는다. Swagger runtime과 분리한 두 번째 Task.

## R1 - 요청 계약

- AC-R1-1: login은 provider별 oneOf 4개. google/kakao는 provider·credential, naver는 state, apple은 loginAttemptId 필수다. 추가 필드는 금지한다.
- AC-R1-2: start는 무본문 또는 빈 객체, refresh/logout은 refreshToken 본문이다. 인증 발급 경로는 서비스 Bearer를 요구하지 않는다.

## R2 - 응답 계약

- AC-R2-1: login 200 user·서비스 토큰, start 201 시도·nonce·만료, refresh 200 토큰, logout 204 무본문을 명시한다.
- AC-R2-2: 공통 error code/message/details와 API별 400/401/500/503 설명, 앱 첫 GET의 text/html 문자열을 명시한다.

## R3 - 동기화 보호

- AC-R3-1: 실제 문서와 Pipe에서 schema 필수 필드·추가 필드 거부·status·인증 요구를 테스트한다. 기존 인증 동작을 변경하지 않는다.

## Out of Scope

모바일 구현·새 API·배포. 검증 후 Swagger 두 Task를 PR/main 병합하고 feat/auth를 최신화한다.
