# Task Identity와 병렬 작업

Task 생성·식별·병렬 작업 규칙은 이 문서에서만 정의한다. TDD·요구사항·검증·완료 규칙은 [공통 Workflow](AGENTS.md)를 유지한다.
ULID 구성과 인코딩 근거는 [공식 ULID 규격](https://github.com/ulid/spec)이다. 같은 밀리초 안의 생성 순서까지 정렬된다고 보장하지 않는다.

## Identity와 Directory

- 새 ID는 `TASK-<ULID>`다. 표준 Crockford Base32 대문자 26자리 전체 ULID를 사용한다. 예: `TASK-01K6A8F3J7Q2V6BX9P1E4R5T6W`.
- ULID는 48비트 밀리초 시간과 암호학적으로 안전하게 생성한 80비트 난수로 구성한다. 앞 10자리는 시간만, 앞 12자리는 난수 10비트만 포함하므로 병렬 생성에 사용하지 않는다. 첨부 요구의 독립 생성·낮은 충돌 확률을 위해 전체 길이를 선택한다.
- Directory는 `.agent/tasks/<TASK-ID>-<slug>/`다. slug는 title의 핵심 의미를 짧은 lowercase kebab-case로 표현한다. slug는 ID의 일부가 아니다.
- 실제 Identity는 task.yaml의 id다. title 변경으로 id를 바꾸지 않으며 Directory slug도 특별한 이유 없이 변경하지 않는다.
- 기존 최대 번호, Directory 개수, Git History, 다른 Worktree, 중앙 sequence/registry를 조회해 ID를 계산하지 않는다. 동일 밀리초에도 각 Agent가 독립적인 난수를 생성한다.
- 생성할 경로가 이미 있으면 덮어쓰지 않고 새 ULID를 생성한다. 이것은 로컬 덮어쓰기 방지이며 중앙 조정이 아니다. 중복 ID가 merge에서 발견되면 별개 Task 중 하나의 ID를 재발급하고 참조를 갱신한다.

## 생성 절차

1. 표준 ULID 구현 또는 아래 Node.js 예시로 새 ULID를 생성한다.
2. `TASK-`를 붙여 id를 확정한다.
3. title에서 slug를 정하고 Directory를 만든다.
4. templates/task의 네 파일을 복사한다.
5. task.yaml의 id/title/created_at과 상태·요약을 초기화하고 요구사항·승인 근거를 작성한다.

Node.js 예시(저장소 상태·네트워크에 의존하지 않음):

```js
import { randomBytes } from 'node:crypto';
const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
let value =
  (BigInt(Date.now()) << 80n) | BigInt('0x' + randomBytes(10).toString('hex'));
let ulid = '';
for (let i = 0; i < 26; i++) {
  ulid = alphabet[Number(value & 31n)] + ulid;
  value >>= 5n;
}
console.log('TASK-' + ulid);
```

## 메타데이터

created_at은 ID와 별도로 유지한다. 새 Task에는 실제 생성 시각을 시간대가 포함된 ISO 8601로 기록한다(예: `2026-10-02T10:06:21+09:00`). updated_at도 실제 갱신 시각을 같은 형식으로 기록한다.
이관한 과거 Task의 실제 생성 시각을 모르면 시간을 지어내지 않는다. 기존 `YYYY-MM-DD`는 ISO 8601 날짜 메타데이터로 보존하고 progress.md에 시각 미상임을 남긴다.
ULID의 시간은 ID 발급 시각이며 이관된 Task의 과거 작업 시각을 대신하지 않는다.

## 병렬 Worktree / Clone

각 Agent는 다른 checkout의 Task 상태를 모른다고 가정한다. 자기 checkout의 Task Directory만 수정하며 다른 Agent의 Task를 임의로 수정하지 않는다.
Task 전용 브랜치가 필요하면 기존 브랜치 규칙을 우선한다. 신규 브랜치 기본 prefix는 `codex/`이며 `codex/<TASK-ID>-<slug>`처럼 ID를 재사용할 수 있다. 사용자 지정 브랜치를 바꾸지 않는다.
서로 다른 Task Directory는 동일 파일 생성 충돌을 줄인다. 공통 지침·템플릿·제품 코드 등 공유 파일의 merge conflict까지 없애는 것은 아니다. merge 시 별도 검토·해결한다.

## Source of Truth와 목록

각 Directory의 task.yaml / requirement.md / progress.md / verification.md가 Source of Truth다. ID/title/created_at/status는 task.yaml에서 읽는다.
`.agent/tasks/README.md`는 목록 조회 방법만 안내하는 고정 문서다. Task 생성·완료마다 표나 현재 상태를 수동 편집하지 않는다.
전체 Task 목록은 현재 checkout의 `.agent/tasks/*/task.yaml`을 읽어 계산한다. 다른 브랜치의 기능이 존재한다고 가정하지 않는다.
Dashboard를 만들면 파생 뷰로 취급하고 필요할 때 다시 생성한다. `.agent/TASKS.md`는 Git에서 제외하여 여러 Agent가 생성 결과를 merge하지 않는다.

## 기존 Task

원칙적으로 기존 순차 ID와 경로는 보존하고 새 Task부터 새 규칙을 적용한다. 과거 Git History를 다시 쓰지 않는다.
2026-10-02에는 사용자가 TASK-001과 feat/auth의 기존 Task를 새 지침에 맞추도록 직접 요청했으므로 해당 문서의 ID·경로 이관을 예외적으로 승인했다.
각 이관 Task의 progress.md에 이전 ID·새 ID·이유를 남기고 링크·parent 등을 갱신한다. 이후 새 ID는 고정한다. 실제 요구사항·검증 이력·결과는 보존한다.
