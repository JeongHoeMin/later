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

Decision: 원문은 randomBytes(32) base64url이고 DB에는 SHA-256 해시만 저장한다. Reason: DB 유출 시 원문 토큰의 직접 사용을 줄인다.
Decision: 로그인마다 별도 30일 세션을 만들고 갱신 시 만료를 연장하지 않는다.
Decision: 사용된 토큰을 보존해 재사용을 탐지하고 해당 세션을 폐기한다. transaction 안에서는 reused를 반환하고 commit 후 유스케이스가 오류를 던진다. Reason: throw로 폐기까지 롤백되지 않게 한다.
Decision: 세션 row를 FOR UPDATE로 잠그고 상태를 재조회한다. Reason: 같은 토큰의 갱신과 로그아웃을 직렬화한다.
Decision: 새 Access Token 서명 후 토큰 교체를 수행한다. Reason: 서명 실패만으로 기존 토큰을 소비하지 않는다.

## Issues / Blocker

기록 작업 blocker 없음. 클라이언트는 갱신을 하나씩 실행하고 새 Refresh Token으로 교체해야 한다. 이미 폐기된 세션의 만료 전 Access Token 차단과 모든 기기 일괄 로그아웃은 구현 범위 밖이다.

## Discovered Requirements

없음. 제한 사항은 현재 범위의 설명이며 임의로 추가 구현하지 않는다.

## Failed Attempts

과거 실패 접근의 확정된 실행 근거가 없어 추가로 추정하지 않는다.

## Next Action

없음. 사후 기록과 현재 재검증을 완료했다. 다음 Product Task는 목록의 카카오 작업이며 사용자 승인 후 시작한다.
