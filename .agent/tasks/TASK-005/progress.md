# Progress

## Current State

feat/auth의 기존 구현을 사후 정리했다. 사용자 요청이 기록 작업을 승인했다.
RED 실행 로그는 Git만으로 증명할 수 없어 확인 불가로 남긴다. 현재 GREEN은 이번 전체 API 재실행에서 확인했다.

## Completed

기존 구현·테스트와 R/AC/Test 연결, 중요한 결정 정리.

## In Progress

없음.

## Remaining

없음. 기존 기능의 사후 기록과 현재 baseline 검증을 완료했다.

## Decisions

Decision: jose로 HS256 JWT를 발급·검증한다. typ at+jwt, issuer later-api, audience later-mobile, sub 회원 ID, iat/exp, jti를 사용한다.
Decision: 유효 시간은 900초이며 secret은 최소 32바이트다. 같은 시각의 같은 회원에게도 jti를 달리 발급한다.
Decision: Guard는 명시적으로 적용하고 검증된 회원 ID를 request.user에 둔다. Reason: 공개 경로와 보호 경로를 구분한다.

## Issues / Blocker

기록 작업 blocker 없음. Guard는 회원 상태·역할·세션 폐기를 DB에서 조회하지 않는다. 로그아웃 후 이미 발급된 Access Token은 최대 15분간 유효하다. 실제 보호 비즈니스 라우터는 후속 범위다.

## Discovered Requirements

없음. 제한 사항은 현재 범위의 설명이며 임의로 추가 구현하지 않는다.

## Failed Attempts

과거 실패 접근의 확정된 실행 근거가 없어 추가로 추정하지 않는다.

## Next Action

없음. 사후 기록과 현재 재검증을 완료했다. 다음 Product Task는 목록의 카카오 작업이며 사용자 승인 후 시작한다.
