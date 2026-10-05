# Requirement

## Goal

사용자 요청에 따라 Swagger main 병합 뒤 feat/auth를 최신화하고 로그인 프로세스 API들을 기존 인증과 연동한다. 모바일 API 클라이언트를 토큰 수명주기·각 제공자 SDK와 별도 Task로 분리해 순차 진행한다.

## R1 - 인증 API 호출

- AC-R1-1: 서버 계약대로 social login 4-provider 입력, Apple start, refresh, logout을 HTTP 호출한다. POST JSON과 200/201/204 상태를 지키고 성공 응답을 검증한다.
- AC-R1-2: 추가 subject나 제공자 토큰을 서비스 bearer로 사용하지 않는다. 인증 발급 API에는 bearer를 붙이지 않는다.

## R2 - 실패와 설정

- AC-R2-1: 400/401/503 등의 공통 error.code와 status를 호출자에게 전달하고 토큰·외부 원문·스택을 사용자 오류에 포함하지 않는다. 통신 오류·잘못된 응답을 구분하고 타임아웃을 적용한다.
- AC-R2-2: 명시적인 API base URL 설정을 사용하고 네트워크 주소를 하드코딩하지 않는다.

## Out of Scope

토큰 보안 저장·수명주기와 SDK·UI는 다음 별도 Task다. 모바일 실제 앱 ID/SDK 환경 설정 및 실제 기기 로그인을 완료했다고 주장하지 않는다. 이 단계 이후 auth push/PR/병합은 현재 승인에 포함하지 않는다.
