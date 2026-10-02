# Requirement

## Background / Goal

사용자가 2026-10-02 카카오 인증 어댑터, 기존 로그인 API 확장, 테스트→RED→구현→GREEN→검증→커밋 범위를 승인했다.
구글 로그인·회원 연결·서비스 토큰 발급 흐름에 카카오를 추가한다.

## R1 - 카카오 서버 인증

- AC-R1-1: 카카오 Access Token으로 고정 HTTPS 토큰 정보 API를 호출해 사용자 ID를 확인한다. 원문은 Authorization 헤더로만 전달하고 저장하지 않는다.
- AC-R1-2: 양의 앱 ID와 남은 유효 시간을 검증한다. 다른 앱·만료·잘못된 토큰은 인증 실패다. 빈 credential은 요청 전에 거부한다.
- AC-R1-3: 잘못된 응답·네트워크·타임아웃·서버 장애는 인증 불가 오류로 구분하고 회원 처리를 실행하지 않는다. 요청은 5초 안에 중단하며 redirect를 따라가지 않는다.

## R2 - 설정과 회원 연결

- AC-R2-1: KAKAO_APP_ID는 양의 안전한 정수 형태로 필수 설정하며 앱 키와 구분한다. 설정 오류는 모듈 구성 시 거부한다.
- AC-R2-2: AuthModule에 카카오 어댑터를 등록하고 검증된 (kakao, subject)를 기존 회원 연결 유스케이스로 전달한다. 구글 흐름을 유지한다.

## R3 - HTTP와 서비스 세션

- AC-R3-1: POST /auth/social/login에서 google 또는 kakao를 허용하고 provider를 보존한다. 카카오 신규·기존 회원은 기존 형식의 서비스 토큰 쌍을 받는다.
- AC-R3-2: 요청 실패는 400, 인증 실패는 401/SOCIAL_AUTHENTICATION_FAILED, 인증 제공자 장애는 503/INTERNAL_SERVER_ERROR다. 실패 시 회원·세션 저장 없이 공통 오류 계약을 따른다.

## Out of Scope

네이버, 모바일 SDK·인가 코드 교환, 카카오 토큰 갱신·로그아웃, 프로필 수집·계정 통합, DB 스키마 변경, auth PR/push.
JSON 숫자로 받는 회원 ID는 Number.isSafeInteger 범위만 허용한다. 그 밖의 ID는 정밀도 손실을 방지하기 위해 응답 오류로 거부하며 문자열 전환을 추정하지 않는다.
