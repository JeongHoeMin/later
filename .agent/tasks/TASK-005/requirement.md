# Requirement

## Background / Goal

서비스 Access Token과 인증 Guard의 기존 구현을 새 Agent가 이어받을 수 있도록 2026-10-02 사후 기록한다.
이 문서는 과거 구현의 기대 Behavior를 현재 코드와 대조해 정리한 baseline이며 새로운 기능 구현 승인이 아니다.
근거 커밋: bd4cb98, 8d359d1 (jti 추가).

## R1 - 토큰 발급

- AC-R1-1: 회원 ID로 15분 토큰을 발급하고 동일 시각 재발급도 다른 토큰을 반환한다.

## R2 - 위조·만료·claim 거부

- AC-R2-1: 서명 키·알고리즘·issuer·audience·typ·시간·필수 claim 검증에 실패하면 인증을 거부한다.

## R3 - 보호 경로 인증

- AC-R3-1: 유효한 Bearer 토큰은 회원 ID를 전달하고 누락·잘못된 토큰은 공통 401로 응답한다.

## R4 - 시스템 오류 구분

- AC-R4-1: 검증 시스템 오류를 인증 실패로 바꾸지 않고 500으로 전달한다.

## Out of Scope / Limits

Guard는 회원 상태·역할·세션 폐기를 DB에서 조회하지 않는다. 로그아웃 후 이미 발급된 Access Token은 최대 15분간 유효하다. 실제 보호 비즈니스 라우터는 후속 범위다.
