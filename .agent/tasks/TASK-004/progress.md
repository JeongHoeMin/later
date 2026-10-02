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

Decision: 소셜 제공자 포트가 검증한 subject만 회원 유스케이스에 전달한다. Reason: DB에 계정이 존재한다는 사실로 외부 인증을 대체할 수 없다.
Decision: Google OAuth2Client가 ID 토큰 서명·audience·만료 등을 검증한다. Reason: 우리 앱용 토큰으로 사용자 신원을 확인한다.
Decision: 가입과 로그인은 POST /auth/social/login 하나에서 처리한다. 기존 회원이면 조회하고 없으면 생성한다.
Decision: 입력은 Pipe, 인증 실패의 401 변환은 Controller, 내부 오류는 공통 필터가 처리한다.

## Issues / Blocker

기록 작업 blocker 없음. 현재 실제 어댑터와 HTTP provider는 google만 지원한다. kakao/naver는 목표와 도메인 enum에만 포함된다. 외부 구글 서버와 모바일 앱을 연결한 수동 로그인은 이번 검증에 포함하지 않았다.

## Discovered Requirements

없음. 제한 사항은 현재 범위의 설명이며 임의로 추가 구현하지 않는다.

## Failed Attempts

과거 실패 접근의 확정된 실행 근거가 없어 추가로 추정하지 않는다.

## Next Action

없음. 사후 기록과 현재 재검증을 완료했다. 다음 Product Task는 목록의 카카오 작업이며 사용자 승인 후 시작한다.
