# Verification

`apiRequest`(HTTP 경계)와 expo-secure-store는 테스트에서 대체하고, 갱신 직렬화·세션 만료·복원·탈퇴 판단은 실제 구현을 사용한다.
RED는 최소 선언(`Not implemented` throw, 빈 컴포넌트, 헤더 미전달) 상태에서 `pnpm test`로 확인했다: 25개 실패, 기존 55개 PASS. 실패 원인은 모두 기대 동작 부재(Not implemented·요소 없음·헤더 누락)였다.

## T-R2-1

- Requirement / AC: R2 / AC-R2-1 ~ AC-R2-5
- Behavior: Bearer 헤더, 401 시 한 번 갱신·저장·재시도, 동시 401의 갱신 1회, 갱신 401·재시도 401의 세션 만료와 알림, 일시 오류 시 토큰 유지, 401 외 오류 전달.
- Verification Type: UNIT
- Test: `apps/mobile/src/features/auth/session/__tests__/authorizedRequest.test.ts` (describe `authorizedRequest`), `apps/mobile/src/shared/api/__tests__/apiClient.test.ts` ("추가 헤더를 기본 헤더와 함께 보내고 DELETE를 지원한다")
- RED: PASS (Not implemented / Authorization 헤더 누락으로 실패)
- GREEN: PASS
- REFACTOR: N/A (최소 구현이 책임별 함수로 분리됨)
- Result: PASS
- Evidence: 7 + 1 PASS. 단일 갱신 보장은 변이 확인(`??=`를 `=`로 바꾸면 동시 갱신 테스트 1건 실패)으로 테스트가 동작을 보호함을 확인했다.

## T-R1-1

- Requirement / AC: R1 / AC-R1-1 ~ AC-R1-4
- Behavior: 저장 토큰 없음→서버 미호출 signedOut, `/auth/me`로 signedIn, 갱신 거부→토큰 삭제 signedOut, 네트워크 오류→토큰 유지 후 throw.
- Verification Type: UNIT
- Test: 같은 파일 (describe `restoreSession`)
- RED: PASS (Not implemented)
- GREEN: PASS
- REFACTOR: N/A
- Result: PASS
- Evidence: 4/4 PASS.

## T-R3-1

- Requirement / AC: R3 / AC-R3-1 ~ AC-R3-3
- Behavior: `DELETE /users/me`(Bearer) 성공 시 토큰 삭제, 갱신 401이어도 완료, 500이면 토큰 유지 후 throw. 화면: 확인 대화상자 취소 시 미호출, 탈퇴 선택 시 호출, 실패 시 재시도 안내.
- Verification Type: UNIT, UNIT(컴포넌트)
- Test: 같은 파일 (describe `withdraw`), `apps/mobile/src/features/auth/__tests__/AccountActions.test.tsx`
- RED: PASS (Not implemented / 버튼 없음)
- GREEN: PASS
- REFACTOR: N/A
- Result: PASS
- Evidence: 3 + 4 PASS.

## T-R4-1

- Requirement / AC: R4 / AC-R4-1, AC-R4-2
- Behavior: 복원 결과별 상태(restoring→signedIn/signedOut/restoreFailed), 재시도, 로그인·로그아웃·탈퇴 성공/실패, 세션 만료 알림 반영.
- Verification Type: UNIT(hook)
- Test: `apps/mobile/src/features/auth/session/__tests__/useAuthSession.test.ts`
- RED: PASS (Not implemented)
- GREEN: PASS
- REFACTOR: N/A
- Result: PASS
- Evidence: 6/6 PASS. `App.tsx`의 상태별 화면 분기와 `SessionRestoreScreen`은 hook 결과를 그대로 표시하는 조립 코드로 tsc로 확인했다.

## T-CONTRACT-1

- Requirement / AC: R1~R3 오류 매핑의 서버 계약 대조
- Verification Type: MANUAL (실행 서버 `http://localhost:3000`, 2026-10-06)
- Result: PASS
- Evidence: `GET /auth/me`·`DELETE /users/me` Bearer 없음 → 401 AUTHENTICATION_REQUIRED, 잘못된 Bearer → 401 INVALID_ACCESS_TOKEN, `POST /auth/token/refresh` 잘못된 토큰 → 401 INVALID_REFRESH_TOKEN, `POST /auth/logout` 잘못된 토큰 → 204. `/docs-json`의 경로·본문 스키마(refreshToken 단일 필드, additionalProperties false)와 클라이언트 요청 형식 일치.

## T-MANUAL-1

- Requirement / AC: R1~R4 실제 기기
- Verification Type: MANUAL (에뮬레이터·실기기 + 개발 서버)
- Result: NOT_STARTED
- Evidence: 실제 제공자 로그인이 필요해 부모 Task(T-R4-2/T-R6-2)의 수동 로그인 확인과 함께 수행한다. 확인 항목: 로그인 후 앱 재시작 시 홈 유지, 서버 중지 상태 재시작 시 재시도 화면, 탈퇴 후 로그인 화면·같은 계정 재로그인 시 새 회원 ID.

## Final Verification

- `pnpm test` (apps/mobile): PASS, 8 suites, 80 tests.
- `npx tsc --noEmit` (apps/mobile): PASS.
- `pnpm exec eslint apps/mobile/App.tsx apps/mobile/src`: PASS.
- `prettier --check apps/mobile/App.tsx apps/mobile/src`: PASS. `docs/service-policy.md`는 HEAD부터 prettier 불일치가 있어 전체 재포맷하지 않았다.
- 서비스 정책·구성 문서: `docs/service-policy.md` "모바일 앱 적용 상태", `docs/service-architecture.md` "모바일 클라이언트" 추가. 각 항목을 코드(authorizedRequest·restoreSession·withdraw·useAuthSession·loginWithProvider·providers)와 대조했다.
- 실제 기기 수동 확인: NOT_STARTED (T-MANUAL-1).
