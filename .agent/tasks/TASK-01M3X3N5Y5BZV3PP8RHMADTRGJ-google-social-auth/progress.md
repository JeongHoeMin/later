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

없음. 이 Task의 사후 기록은 완료했다. 카카오·네이버 후속 구현도 완료했으며 최신 인증 상태는 [네이버 Task](../TASK-01M3X3N5YE122YB2CP9Z2642J7-naver-social-auth/task.yaml)를 참고한다. 모바일 SDK·로그인 시도 보호는 별도 승인 후 진행한다.

## Task Identity 이관 (2026-10-02)

- 이전 ID: TASK-004
- 새 ID: TASK-01M3X3N5Y5BZV3PP8RHMADTRGJ
- Directory: TASK-01M3X3N5Y5BZV3PP8RHMADTRGJ-google-social-auth
- 승인: 기존 Task도 수정된 지침에 맞춰 정리하라는 사용자의 직접 요청. 일반적인 기존 ID 유지 규칙의 명시적 예외다.
- 기존 created_at은 실제 시각 미상이므로 날짜를 보존했다. 새 ULID의 시각은 이관 시각이며 과거 작업 시각이 아니다.
- 제품 동작·기존 R/AC·RED/GREEN 결과는 보존했다. 문서 전용 이관은 TDD N/A이며 YAML·링크·ID/Directory·상태·diff를 검증한다.
