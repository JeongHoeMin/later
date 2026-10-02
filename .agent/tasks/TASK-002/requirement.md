# Requirement

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
