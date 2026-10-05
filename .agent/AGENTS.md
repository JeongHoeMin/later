# 공통 Agent Workflow

Codex, Claude Code 등 모든 개발 Agent가 따르는 규칙이다. 특정 스킬이나 개인 경로가 없어도 실행할 수 있어야 한다.

## 시작과 승인

1. `git status --short`, 현재 브랜치와 관련 하위 지침을 확인한다. 사용자 변경과 미추적 파일을 보존한다.
2. [project.md](project.md), [tasks/README.md](tasks/README.md)를 읽고 현재 checkout의 Task Directory에서 미완료 Task를 확인한다. 다른 브랜치의 Task를 임의로 실행하지 않는다.
3. 해당 Task의 `task.yaml → requirement.md → progress.md → verification.md`를 읽고 실제 코드·테스트·Git과 대조한다.
4. 새 작업 세트마다 목표, 범위, 검증 방법을 먼저 설명하고 사용자의 승인을 받는다. 이미 승인된 범위는 재승인 없이 끝까지 수행한다. 기록된 Next Action은 승인 자체가 아니다.
5. 새 Task는 [Task Identity와 병렬 작업 규칙](task-identity.md)에 따라 독립적으로 생성한 ULID ID와 slug Directory에 템플릿 네 파일을 복사한다. 승인 근거는 progress.md에 짧게 남긴다. 중앙 목록을 수동 갱신하지 않는다.

## 개발 순서

Requirement → Acceptance Criteria → Test 설계 → RED → 최소 구현 → GREEN → 필요한 REFACTOR → Verification → 문서 갱신 → 커밋.

- Requirement는 `R1`, Acceptance Criteria는 `AC-R1-1`, Test Case는 `T-R1-1`로 연결한다. 코드 테스트 이름에 ID를 강제하지 않는다. 문서에 실제 파일과 테스트 이름을 연결한다.
- 새 기능과 Bug Fix는 테스트부터 작성한다. RED는 기대 동작 때문에 실패했음을 실행 결과로 확인한다. import 오류·문법 오류·환경 장애는 RED가 아니다. 테스트 실행에 필요한 최소 선언만 먼저 둘 수 있다.
- 처음부터 PASS하면 기존 동작, 잘못된 테스트, 검증 대상 누락 중 무엇인지 확인한다. 기존 동작의 회귀 검증과 구현 전 RED를 구분한다.
- GREEN은 현재 Behavior를 만족하는 최소 구현이다. 실패 테스트 삭제, 테스트를 맞추기 위한 요구사항 변경, 승인되지 않은 미래 기능 추가를 금지한다.
- Bug Fix는 재현 테스트 → RED → 수정 → GREEN → 관련 회귀 검증 순서다.
- 순수 Refactoring은 기존 GREEN을 확인하고 진행한다. 보호망이 부족하면 Characterization Test부터 추가한다. Refactoring 후 관련 테스트를 다시 실행한다.
- 문서만 변경하거나 동작에 영향 없는 설정 변경은 자동화 테스트를 억지로 만들지 않는다. progress.md에 TDD 예외의 이유와 대신 수행한 검증을 남긴다. 동작을 바꾸는 설정은 TDD 대상이다.
- 테스트는 입출력과 관찰 가능한 동작을 검증한다. 외부 API는 경계에서 대체하고 핵심 로직은 실제 구현을 사용한다. 모든 AC에 모든 테스트 레이어를 요구하지 않는다.
- 현재 프로젝트에는 LLM 기능이 없다. 향후 결정론적인 검증·상태 전이는 TDD, 비결정론적인 LLM 품질은 데이터셋·기준·회귀 결과를 갖춘 Eval로 검증한다.

## 문서의 책임

| 문서              | 관리하는 내용                                                                      |
| ----------------- | ---------------------------------------------------------------------------------- |
| task.yaml         | ID, 제목, status, phase, priority, 날짜, 요약, 다음 행동, blocker; 필요하면 parent |
| requirement.md    | 기대 Behavior, AC, Out of Scope                                                    |
| verification.md   | 구현 전 Test 설계, AC와 실제 테스트 연결, RED/GREEN/REFACTOR 및 결과               |
| progress.md       | 현재 상태, 중요한 결정, 이슈, 발견한 요구사항, 실패 접근, 구체적인 다음 행동       |
| Git / Test Runner | 변경 이력 / 실제 실행 근거                                                         |

- status: `pending`, `in_progress`, `blocked`, `completed`, `cancelled`.
- phase: `requirement`, `planning`, `implementation`, `verification`, `documentation`, `completed`. RED/GREEN/REFACTOR는 phase에 넣지 않는다.
- 검증 상태: `NOT_STARTED`, `IN_PROGRESS`, `PASS`, `FAIL`, `BLOCKED`, `N/A`. RED의 PASS는 기대 실패를 확인했다는 의미다. Refactoring을 하지 않았으면 N/A와 이유를 쓴다.
- 과거 작업을 사후 기록할 때 실행 로그가 없으면 `N/A (사후 기록·확인 불가)`로 표시한다. 과거 RED를 만들기 위해 코드를 되돌리거나 확인하지 않은 PASS를 쓰지 않는다. 현재 재검증은 별도로 기록한다.
- 중요한 상태 변화와 작업 중단 전에 갱신한다. 모든 명령·실행 시각·파일 변경을 기록하지 않는다. 복잡한 작업만 plan.md/design.md 등을 추가한다.
- 새로운 요구사항은 `DISC-XXX / NEEDS_CONFIRMATION`으로 기록하고 승인 후 정식 R로 승격한다.
- 결정은 Decision/Reason을 쓰고 중요한 대안만 Alternatives에 남긴다. Observed와 Hypothesis를 구분한다.
- Blocker에는 원인과 재개 조건을 적는다. 미완료 Next Action은 테스트 ID, 현재 상태, 수정 대상, 재실행 명령, 필요한 승인을 포함한다.
- completed Task의 next_action은 null이다. 다음 Task 제안은 관련 Task의 progress.md와 최종 보고에 남긴다. 전체 목록은 Task Directory에서 계산한다.

## 서비스 정책 문서 갱신

- 구현된 서비스 정책의 기준 문서는 [docs/service-policy.md](../docs/service-policy.md)다. 정책이 포함된 작업을 시작할 때 관련 항목을 읽는다.
- 가입·로그인·권한·제한 횟수·유효기간·탈퇴·보존/삭제·결제 등 사용자에게 영향을 주는 규칙을 새로 구현하거나 변경하면 **항상 같은 파일의 해당 항목을 구현과 함께 갱신**한다. 기능별 별도 문서로 기준 정책을 분산하지 않는다. 상세 API/운영 문서는 링크로 연결한다.
- 코드로 확인된 구현 정책과 미구현 기획·운영 적용 상태를 구분하고 수치·조건·예외·오류·미지원 범위를 기록한다. 비밀값이나 운영 인증 정보는 적지 않는다.
- Task requirement에서 정책 영향을 확인하고 progress/verification에 갱신 항목과 코드 대조 결과를 남긴다. 정책 영향이 없으면 해당 없음을 기록한다. 정책 문서 갱신과 검증을 완료하기 전 Task completed·커밋으로 진행하지 않는다.

## 서비스 구성 문서 갱신

- 현재 서비스 구성의 기준은 [docs/service-architecture.md](../docs/service-architecture.md)다. 관련 작업 시작 시 해당 항목을 읽는다.
- API 모듈/외부 의존성, DB·Redis 등 저장소 역할, 데이터 흐름, 배포·네트워크·백그라운드 작업·관측 구성이 변경되면 **항상 같은 작업에서 이 파일의 구성도와 설명을 갱신**한다.
- 코드/설정으로 확인한 구현, 계획, 로컬 구성과 운영 적용 상태를 구분하고 비밀값·실제 접속 정보는 기록하지 않는다. 서비스 정책은 기존 단일 기준 문서에 유지한다.
- Task requirement에 구성 영향을, progress/verification에 갱신 항목과 코드/설정 대조 결과를 기록한다. 영향이 없으면 이유를 적는다. 문서 갱신·검증 전 completed·커밋으로 진행하지 않는다.

## 검증과 완료

필수 R/AC와 필요한 RED, GREEN, Refactoring 후 결과를 확인한다. 관련 테스트와 변경된 앱의 전체 Suite, 타입·린트·빌드 등 [프로젝트 검증](project.md#검증)을 수행하고 결과를 기록한다.
다른 앱에 영향이 없으면 그 앱의 Suite를 강제하지 않으며 범위를 명시한다. 문서 전용 변경은 링크·YAML·템플릿·지침 일관성과 diff를 검증한다.
실패·실행 불가·기존 회귀를 숨기지 않는다. 필수 검증이 막히면 completed로 처리하지 않는다. 필요한 Eval, blocker 해소, 네 문서 갱신까지 끝나야 completed다.

## Git과 보고

- main에 직접 개발 커밋하지 않는다. 사용자 지정 브랜치를 따르고 공통 변경을 main 기준 별도 브랜치로 분리할 때 기존 작업을 안전하게 보관한다. 강제 reset/clean, 사용자 변경 덮어쓰기, 무단 force push를 하지 않는다.
- 검증 후 이번 Task 파일만 명시적으로 stage한다. 미추적 Nest scaffold나 생성 코드를 일괄 추가하지 않는다.
- 커밋은 한국어 Conventional Commit: `feat(api): ...`, `fix(api): ...`, `test(api): ...`, `docs: ...`.
- PR 본문은 문제와 결과, 범위, 검증, 제한 사항을 설명한다. push·PR·병합은 사용자 승인 범위에서 수행한다. 승인 없으면 로컬 커밋까지 하고 구체적인 결과를 제시한다.
- 사용자 요청에 따라 **검증된 작업을 커밋한 뒤 항상 현재 작업 브랜치를 해당 원격 브랜치로 push**한다. 사용자 변경은 커밋/푸시에 포함하지 않고 force push는 하지 않는다. 원격 변경과 충돌하거나 push가 실패하면 원인을 확인·보고하고 안전한 해결을 진행한다. PR 생성·병합·배포 권한은 push 승인과 별개다.
- 커밋 후 결과·검증·커밋·제한 사항을 보고하고 항상 다음 작업을 제안해 승인을 묻는다. 승인 전 다음 기능 구현을 시작하지 않는다.
- 응답과 작업 문서는 한국어로 명확하고 간결하게 작성한다. 비밀키, DB URL, 실제 인증 토큰은 문서·로그·커밋에 남기지 않는다.
