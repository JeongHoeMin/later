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

Decision: APP_FILTER로 ApiExceptionFilter를 등록한다. 오류 본문만 error/code/message/details 형태로 통일하고 성공 응답은 유지한다.
Decision: 5xx와 알 수 없는 오류는 서버에 기록하고 내부 메시지는 숨긴다. 명시적 HTTP status는 유지한다.
Decision: 도메인 오류는 HTTP 경계에서 변환한다. Reason: 공통 필터가 특정 도메인에 의존하지 않게 한다.

## Issues / Blocker

기록 작업 blocker 없음. 성공 응답의 공통 wrapper는 적용하지 않았다. 이 공통 구현은 main에 이미 병합되어 있다.

## Discovered Requirements

없음. 제한 사항은 현재 범위의 설명이며 임의로 추가 구현하지 않는다.

## Failed Attempts

과거 실패 접근의 확정된 실행 근거가 없어 추가로 추정하지 않는다.

## Next Action

없음. 이 Task의 사후 기록은 완료했다. 카카오·네이버 후속 구현도 완료했으며 최신 인증 상태는 [네이버 Task](../TASK-01M3X3N5YE122YB2CP9Z2642J7-naver-social-auth/task.yaml)를 참고한다. 모바일 SDK·로그인 시도 보호는 별도 승인 후 진행한다.

## Task Identity 이관 (2026-10-02)

- 이전 ID: TASK-007
- 새 ID: TASK-01M3X3N5YAP4G9P1SANAE1CM1S
- Directory: TASK-01M3X3N5YAP4G9P1SANAE1CM1S-http-error-contract
- 승인: 기존 Task도 수정된 지침에 맞춰 정리하라는 사용자의 직접 요청. 일반적인 기존 ID 유지 규칙의 명시적 예외다.
- 기존 created_at은 실제 시각 미상이므로 날짜를 보존했다. 새 ULID의 시각은 이관 시각이며 과거 작업 시각이 아니다.
- 제품 동작·기존 R/AC·RED/GREEN 결과는 보존했다. 문서 전용 이관은 TDD N/A이며 YAML·링크·ID/Directory·상태·diff를 검증한다.
