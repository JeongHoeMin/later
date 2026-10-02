# Progress

이 문서는 카카오·네이버 추가 전 사후 기록 baseline이다. 아래의 현재 상태·검증 수치·미구현 설명은 당시 기록 기준이며 이번 문서 이관의 실행 결과와 구분한다. 최신 제공자 상태는 [네이버 Task](../TASK-01M3X3N5YE122YB2CP9Z2642J7-naver-social-auth/task.yaml)를 참고한다.

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

없음. 이 Task의 사후 기록은 완료했다. 카카오·네이버 후속 구현도 완료했으며 최신 인증 상태는 [네이버 Task](../TASK-01M3X3N5YE122YB2CP9Z2642J7-naver-social-auth/task.yaml)를 참고한다. 모바일 SDK·로그인 시도 보호는 별도 승인 후 진행한다.

## Task Identity 이관 (2026-10-02)

- 이전 ID: TASK-006
- 새 ID: TASK-01M3X3N5Y8E00589ASFEBNK2TC
- Directory: TASK-01M3X3N5Y8E00589ASFEBNK2TC-refresh-session-lifecycle
- 승인: 기존 Task도 수정된 지침에 맞춰 정리하라는 사용자의 직접 요청. 일반적인 기존 ID 유지 규칙의 명시적 예외다.
- 기존 created_at은 실제 시각 미상이므로 날짜를 보존했다. 새 ULID의 시각은 이관 시각이며 과거 작업 시각이 아니다.
- 제품 동작·기존 R/AC·RED/GREEN 결과는 보존했다. 문서 전용 이관은 TDD N/A이며 YAML·링크·ID/Directory·상태·diff를 검증한다.
