# Verification

문서 전용 Task. RED/GREEN/REFACTOR는 모두 N/A (제품 동작 변경 없음).

| Test   | Requirement / AC      | Behavior                                                                   | Type   | Result |
| ------ | --------------------- | -------------------------------------------------------------------------- | ------ | ------ |
| T-R1-1 | R1 / AC-R1-1, AC-R1-2 | 두 루트 진입점이 공통 지침을 가리키고 모바일 지침이 유지된다               | MANUAL | PASS   |
| T-R2-1 | R2 / AC-R2-1, AC-R2-2 | 네 템플릿을 샘플 Task로 구체화하고 YAML·상태·R/AC/Test 연결을 읽을 수 있다 | MANUAL | PASS   |
| T-R3-1 | R3 / AC-R3-1          | 승인·TDD·Git·컨벤션·DB·검증 규칙이 기존 코드와 일치한다                    | MANUAL | PASS   |

## Final Verification

검증 결과: YAML 2개 파싱, 템플릿·Task 필수 파일 8개, Markdown 11개와 상대 링크 8개, 필수 progress section과 허용 상태를 확인했다. 임시 Node 검사 스크립트와 Prettier --check가 exit 0이었다. git diff --cached --check를 커밋 전에 실행한다. 기존 모바일 지침 diff는 없다. R/AC/Test 연결과 승인·TDD·DB·Git 규칙을 실제 auth 코드 및 루트 설정과 수동 대조했다.
Unit/E2E/Integration/타입/빌드/Eval: N/A (문서만 변경). 실행하지 않은 제품 테스트를 PASS로 기록하지 않는다.

## R4 현재 검증 (2026-10-02)

T-R4-1 / AC-R4-1~4 / MANUAL: PASS. 문서의 실제 생성 예제를 서로 다른 임시 checkout에서 같은 timestamp로 실행해 다른 26자리 ID와 경로를 확인했다.
task.yaml 원본으로 Dashboard를 두 번 계산해 동일한 결과를 확인했고 .agent/TASKS.md의 Git ignore를 확인했다.
이관한 샘플의 네 문서·고유 ID·ID와 Directory 일치·completed/next_action=null·YAML·상대 링크를 검사했다.
기존 과거 검증 결과를 다시 실행한 것으로 기록하지 않는다. R4 RED/GREEN/REFACTOR와 제품 Suite는 N/A (문서 전용 변경).
Prettier와 git diff --check를 실행했다. 중앙 sequence/registry나 최대 번호 조회 로직은 없다.
