# Verification

이 문서는 카카오·네이버 추가 전 사후 기록 baseline이다. 아래의 현재 상태·검증 수치·미구현 설명은 당시 기록 기준이며 이번 문서 이관의 실행 결과와 구분한다. 최신 제공자 상태는 [네이버 Task](../TASK-01M3X3N5YE122YB2CP9Z2642J7-naver-social-auth/task.yaml)를 참고한다.

사후 baseline 기록이다. 아래 모든 Case의 RED와 REFACTOR는 **N/A (과거 실행 로그 확인 불가)**다.
현재 테스트가 PASS하더라도 과거 Test First를 증명하지 않는다. 코드를 되돌려 RED를 재현하지 않는다.

## T-R1-1

- Requirement / AC: R1 / AC-R1-1
- Behavior: 미등록 계정은 null, 등록 계정은 연결된 회원을 반환하고 신규 생성 시 두 레코드를 함께 저장한다.
- Verification Type: INTEGRATION
- Test: `apps/api/src/users/infrastructure/persistence/prisma-social-user.repository.integration-spec.ts` — 「회원을 생성하면 소셜 계정도 저장되어 해당 회원을 조회할 수 있다.」와 같은 파일의 관련 사례.
- RED: N/A (사후 기록·확인 불가)
- GREEN: PASS (2026-10-02 현재 재검증)
- REFACTOR: N/A (과거 실행 로그 확인 불가)
- Result: PASS

## T-R2-1

- Requirement / AC: R2 / AC-R2-1
- Behavior: 중복 생성은 새 회원을 남기지 않으며 동시 요청은 같은 회원을 반환한다.
- Verification Type: INTEGRATION
- Test: `apps/api/src/users/infrastructure/persistence/prisma-social-user.repository.integration-spec.ts` — 「동일 소셜 계정으로 동시에 가입하면 두 요청이 같은 회원을 반환한다」와 같은 파일의 관련 사례.
- RED: N/A (사후 기록·확인 불가)
- GREEN: PASS (2026-10-02 현재 재검증)
- REFACTOR: N/A (과거 실행 로그 확인 불가)
- Result: PASS

## T-R3-1

- Requirement / AC: R3 / AC-R3-1
- Behavior: subject가 같아도 provider가 다르면 별도 회원으로 저장한다.
- Verification Type: INTEGRATION
- Test: `apps/api/src/users/infrastructure/persistence/prisma-social-user.repository.integration-spec.ts` — 「subject가 같아도 제공자가 다르면 별도 회원으로 저장하고 조회한다」와 같은 파일의 관련 사례.
- RED: N/A (사후 기록·확인 불가)
- GREEN: PASS (2026-10-02 현재 재검증)
- REFACTOR: N/A (과거 실행 로그 확인 불가)
- Result: PASS

## T-R4-1

- Requirement / AC: R4 / AC-R4-1
- Behavior: 중복 후 재조회가 실패하거나 일반 오류가 발생하면 원래 오류를 전달한다.
- Verification Type: UNIT
- Test: `apps/api/src/users/application/find-or-create-social-user.use-case.spec.ts` — 「소셜 계정 중복 후 재조회해도 회원이 없으면 원래 오류를 전달한다」와 같은 파일의 관련 사례.
- RED: N/A (사후 기록·확인 불가)
- GREEN: PASS (2026-10-02 현재 재검증)
- REFACTOR: N/A (과거 실행 로그 확인 불가)
- Result: PASS

## Final Verification

2026-10-02 현재 재검증: pnpm test 106 PASS, pnpm test:e2e 38 PASS, pnpm test:integration 17 PASS. tsc --noEmit --incremental false, auth/users/database/test 범위 eslint, pnpm build 모두 exit 0. 관련 테스트 이름과 파일을 현재 코드에서 대조했다.
외부 제공자와 실제 앱의 수동 로그인 및 Eval은 N/A다. 이 문서는 새로운 Product Task의 RED/GREEN 기록을 대체하지 않는다.

## Task Identity 이관 검증 (2026-10-02)

MANUAL / PASS: 새 ULID·slug Directory와 YAML id 일치, ID 고유성, 네 문서·상태·참조 링크·과거 생성 날짜 보존을 확인했다.
RED/GREEN/REFACTOR: N/A (문서 전용 이관). 기존 제품 테스트 실행 결과는 보존했으며 이관만으로 재실행했다고 기록하지 않는다.
