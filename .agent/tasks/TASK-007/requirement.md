# Requirement

## Background / Goal

공통 API 오류 응답의 기존 구현을 새 Agent가 이어받을 수 있도록 2026-10-02 사후 기록한다.
이 문서는 과거 구현의 기대 Behavior를 현재 코드와 대조해 정리한 baseline이며 새로운 기능 구현 승인이 아니다.
근거 커밋: bfe21f7, PR #4 main 병합, 0aa0531 auth 반영.

## R1 - 공통 계약

- AC-R1-1: HTTP 오류 code/message와 검증 details를 반환하고 지정한 code를 유지한다.

## R2 - 내부 오류 은닉

- AC-R2-1: 5xx와 알 수 없는 오류는 내부 내용을 숨기고 서버에 기록한다.

## R3 - 성공 응답 유지

- AC-R3-1: 성공 응답의 기존 형태를 변경하지 않는다.

## Out of Scope / Limits

성공 응답의 공통 wrapper는 적용하지 않았다. 이 공통 구현은 main에 이미 병합되어 있다.
