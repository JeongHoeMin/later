# Requirement

이 문서는 카카오·네이버 추가 전 사후 기록 baseline이다. 아래의 현재 상태·검증 수치·미구현 설명은 당시 기록 기준이며 이번 문서 이관의 실행 결과와 구분한다. 최신 제공자 상태는 [네이버 Task](../TASK-01M3X3N5YE122YB2CP9Z2642J7-naver-social-auth/task.yaml)를 참고한다.

## Background / Goal

2026-10-02 사용자 요청: main 기준 지침 PR을 병합한 뒤 feat/auth로 돌아와 기존 작업을 지침에 따라 기록한다.
PR #5는 main에 병합되었고 merge commit 1d69707로 auth에 반영했다. 보관했던 사용자 파일을 복원했다.

## R1 - 재개 가능한 사후 기록

- AC-R1-1: 회원 연결, 구글 인증·HTTP, Access Token, Refresh 세션, 공통 오류를 각각 네 문서로 기록한다.
- AC-R1-2: 현재 R/AC와 실제 테스트를 연결하고 과거 RED 확인 불가를 명시한다.

## R2 - 현재 상태와 다음 행동

- AC-R2-1: 전체 API 검증 결과와 미구현 카카오·네이버, 실제 앱 로그인 미검증 및 세션 폐기 후 JWT 제한을 구분한다.
- AC-R2-2: 현재 브랜치와 사용자 변경을 보존하고 다음 카카오 구현은 승인 전 시작하지 않는다.

## Out of Scope

Production Code, migration·DB 설정 변경, auth PR 생성·병합, 카카오·네이버 구현.

## R3 - 수정된 지침에 따른 현재 문서 재정리

2026-10-02 사용자가 지침 PR의 main 병합 후 feat/auth 복귀, main 소스 반영, 모든 기존 Task 문서의 새 지침 적용과 로컬 커밋을 명시적으로 승인했다.

- AC-R3-1: 지침 PR #6이 병합된 main을 feat/auth에 반영하고 원래 사용자 파일을 보존한다.
- AC-R3-2: 이전 TASK-002~009를 전체 ULID·slug 경로로 이관하고 네 문서·참조·이전 ID·생성 시각 미상 기록을 유지한다.
- AC-R3-3: 오래된 baseline과 최신 구현 상태를 구분하고 중앙 상태 표 의존을 제거한다. ID의 시간순 조회와 이관 시각의 의미를 명시한다.
- AC-R3-4: 문서·YAML·ID 고유성·경로·링크·Dashboard 파생 뷰와 main 충돌 해결을 검증하고 로컬 커밋한다. auth push·PR은 범위에 없다.

R3의 소스 반영은 이미 main에 있는 소스와 lockfile을 통합하는 범위이며 새 제품 기능은 구현하지 않는다.
