# Requirement

## Background / Goal

다른 Codex 세션과 Claude Code도 저장소만 읽고 승인 범위·개발 원칙·진행 상태·다음 행동을 이해해야 한다.
2026-10-02 사용자 요청이 지침 작성, 커밋, PR, main 병합, feat/auth 복귀와 과거 작업 기록을 승인했다.
이 Task는 템플릿으로 만든 문서 전용 샘플이며 Product Feature를 구현하지 않는다. auth 사후 기록은 병합 후 별도 Task로 작성한다.

## R1 - 공통 진입점

- AC-R1-1: 루트 AGENTS.md와 CLAUDE.md에서 공통 지침을 읽도록 연결한다.
- AC-R1-2: 기존 모바일 지침을 보존하고 충돌 해결 기준을 명시한다.

## R2 - 가벼운 작업 추적

- AC-R2-1: 템플릿과 샘플 Task에 task.yaml, requirement.md, progress.md, verification.md가 존재한다.
- AC-R2-2: 상태·phase·TDD 상태를 분리하고 R→AC→T 추적, blocker 재개 조건과 Next Action을 남긴다.

## R3 - 실제 개발 과정 반영

- AC-R3-1: 승인→TDD→검증→한국어 커밋→다음 제안 흐름과 API 컨벤션·DB 분리·검증 명령을 명시한다.

## Out of Scope

Production Code, 패키지·설정 변경, 새로운 auth 기능, 기존 모바일 지침 재작성.

## R4 - 병렬 Task Identity 지침과 기존 샘플 이관

2026-10-02 사용자가 docs/agent-workflow에서 지침 수정 커밋, 기존 TASK-001의 새 규칙 이관 커밋, push·PR·main 병합을 명시적으로 승인했다.

- AC-R4-1: 순차 번호 조회 없이 전체 ULID와 slug로 독립 생성하며 기존 TDD·요구사항·검증·완료 규칙을 유지한다.
- AC-R4-2: 공통 생성 규칙은 task-identity.md 한 곳에 정의하고 Template·진입점과 일치한다.
- AC-R4-3: 원본은 Task Directory이며 목록은 파생 뷰다. 공유 Dashboard를 수동 편집·커밋하지 않는다.
- AC-R4-4: 사용자 예외 승인에 따라 이 샘플의 ID·Directory를 이관하고 이전 ID와 과거 생성 시각 미상을 기록한다. 기존 요구사항·실행 이력은 보존한다.

R4 범위에는 문서용 파생 Dashboard를 제외하는 .gitignore 규칙만 포함한다. 제품 패키지·런타임 설정은 변경하지 않는다.
