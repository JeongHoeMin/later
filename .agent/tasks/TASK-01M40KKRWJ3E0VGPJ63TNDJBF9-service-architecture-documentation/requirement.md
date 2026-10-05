# Requirement

## R1 · 서비스 구성

- AC-R1-1: docs/service-architecture.md에 API·PostgreSQL·Redis·소셜 제공자 연결을 Mermaid 구성도와 역할/흐름으로 기록한다.
- AC-R1-2: 구현 코드, 로컬 Compose, 운영 미확인 및 미구현 구성을 구분하고 비밀값을 포함하지 않는다.

## R2 · 갱신 의무

- AC-R2-1: 공통 Workflow와 project 지침에 서비스 구성 변경 시 동일 문서 갱신을 명시한다. Task 템플릿에 영향 확인·갱신·검증을 추가한다.

## Service Policy Impact

기존 정책 변경 없음. 정책 기준은 docs/service-policy.md로 유지한다.

## Service Architecture Impact

[서비스 구성](../../../docs/service-architecture.md)의 첫 기준 문서를 작성한다.

## Out of Scope

코드·모바일·배포 수정 및 기존 운영 개선의 구현.
