# Requirement

## Background / Goal

feat/auth의 기존 회원·서비스 세션에 Apple 로그인을 추가한다. 사용자 “진행해”는 서버 시작 API, nonce 저장·만료·일회 사용, Apple ID 토큰 검증, DB 제공자 확장, 모바일 참고 문서, TDD와 로컬 커밋의 승인이다.

## R1 - 로그인 시도

- AC-R1-1: POST /auth/social/apple/start는 무본문 요청으로 UUID loginAttemptId, 256비트 무작위 nonce, expiresIn(300초)를 반환한다. DB에는 nonce의 SHA-256 해시만 저장한다.
- AC-R1-2: 검증된 토큰의 nonce와 일치하는 유효 시도를 한 번만 원자적으로 소비한다. 불일치·만료·누락·재사용·동시 재사용은 회원·서비스 세션 생성 없이 거부한다.

## R2 - Apple 인증

- AC-R2-1: 고정 Apple JWKS로 RS256 서명, iss=https://appleid.apple.com, 설정된 aud, exp, 비어 있지 않은 sub·nonce를 검증한다. (apple, sub)로만 회원을 연결한다.
- AC-R2-2: 잘못된 토큰은 401, JWKS 통신·타임아웃·비정상 응답은 503으로 구분하고 원문을 노출하지 않는다. 공개 키 캐시와 교체 처리를 사용한다.
- AC-R2-3: APPLE_CLIENT_IDS는 쉼표 구분 허용 목록이며 누락·빈 항목·공백 포함을 구성 시 거부한다.

## R3 - HTTP·DB 연결

- AC-R3-1: 로그인 입력은 {provider:apple, credential:ID token, loginAttemptId:UUID}다. 잘못된 ID·추가 필드를 400으로 거부한다.
- AC-R3-2: 신규·기존 회원에게 기존 서비스 토큰을 발급하고 구글·카카오·네이버 계약을 유지한다. enum과 시도 테이블을 비파괴 migration으로 추가한다.

## R4 - 참고 문서

- AC-R4-1: HTTP·모바일 문서에 단계·API·설정·nonce 전달 규칙·재시도와 미구현 영역을 설명한다.

## Out of Scope

모바일 SDK, Apple code 교환·제공자 refresh/revoke, 이메일 자동 통합, 다른 제공자의 서버 nonce/state, push·PR·병합. 실제 Apple 로그인은 앱 설정·모바일 연동 후 수행한다.
