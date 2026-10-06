# Requirement

## Background / Goal

기준: `docs/` 기획·정책·연동 문서와 실행 서버 `GET http://localhost:3000/docs-json`(2026-10-06 조회).
서버는 별도 가입 API·약관·프로필 입력 없이 첫 소셜 로그인에서 회원을 생성한다(`POST /auth/social/login` 200, 신규·기존 동일 응답). 따라서 모바일의 "회원가입"은 소셜 로그인과 같은 흐름이다.

### 모바일 소셜 로그인/회원가입 MVP

| # | 항목 | 상태 |
| - | ---- | ---- |
| M1 | 카카오·구글·네이버(브리지)·Apple(iOS) 로그인 = 첫 로그인 시 가입 | 구현 완료, 기기 수동 확인 대기 (TASK-01M3XFK681BHXV7FYZDXFJ4K3T) |
| M2 | 서비스 토큰 보안 저장과 로그아웃 | 구현 완료 (같은 Task) |
| M3 | 앱 재실행 시 세션 복원(자동 로그인) | 이 Task R1 |
| M4 | 인증 API 요청과 Access Token 자동 갱신(직렬화), 갱신 실패 시 로그인 화면 | 이 Task R2 |
| M5 | 회원 탈퇴(`DELETE /users/me`) — 앱 내 가입을 제공하면 App Store 심사상 앱 내 탈퇴가 필요 | 이 Task R3 |
| - | 소셜 계정 추가 연동·목록, Android Apple, 약관 동의 화면 | MVP 제외 |

## R1 - 앱 세션 복원

### Acceptance Criteria

- AC-R1-1: 저장된 Refresh Token이 없으면 서버를 호출하지 않고 로그아웃 상태로 시작한다.
- AC-R1-2: 저장된 토큰이 있으면 `GET /auth/me`(Bearer)로 회원 ID를 확인해 로그인 상태로 시작한다. Access Token이 만료(401)면 R2의 갱신 후 다시 확인한다.
- AC-R1-3: 갱신이 `401`(만료·폐기·탈퇴)이면 로컬 토큰을 지우고 로그아웃 상태로 시작한다.
- AC-R1-4: 네트워크·5xx·429로 확인하지 못하면 토큰을 지우지 않고 재시도 화면을 보여 준다.

## R2 - 인증 요청과 토큰 자동 갱신

### Acceptance Criteria

- AC-R2-1: 인증 요청은 `Authorization: Bearer <accessToken>`을 보낸다.
- AC-R2-2: 인증 요청이 401이면 `POST /auth/token/refresh`로 한 번 갱신하고, 새 토큰을 저장한 뒤 원 요청을 한 번만 재시도한다.
- AC-R2-3: 동시에 여러 요청이 갱신을 필요로 해도 갱신 요청은 한 번만 보낸다(재사용 탐지로 세션이 폐기되지 않게).
- AC-R2-4: 갱신이 401이거나 갱신 후에도 401이면 로컬 토큰을 지우고 세션 만료를 알려 로그인 화면으로 돌아간다. 그 외 갱신 오류는 토큰을 유지하고 오류를 전달한다.
- AC-R2-5: 토큰을 로그에 남기지 않는다.

## R3 - 회원 탈퇴

### Acceptance Criteria

- AC-R3-1: 확인 대화상자에서 동의한 경우에만 `DELETE /users/me`를 호출한다.
- AC-R3-2: 204이면 로컬 토큰을 지우고 로그인 화면으로 돌아간다. 401(이미 탈퇴·만료)도 로그인 화면으로 돌아간다.
- AC-R3-3: 네트워크·5xx면 토큰을 유지하고 "잠시 후 다시 시도" 안내를 표시한다.

## R4 - 앱 화면 상태

### Acceptance Criteria

- AC-R4-1: 복원 중에는 로딩, 결과에 따라 로그인 화면·홈 화면·재시도 화면을 표시한다.
- AC-R4-2: 로그인 성공, 로그아웃, 탈퇴, 세션 만료가 화면 상태에 반영된다.

## 정책·구성 영향

- 서비스 정책: 서버 정책(토큰 수명·갱신 직렬화·탈퇴 즉시 삭제)을 따르는 클라이언트 구현이며 정책을 새로 정하지 않는다. `docs/service-policy.md`에 모바일 적용 상태만 덧붙인다.
- 서비스 구성: 모바일 → API 호출 경로(`/auth/me`, `/auth/token/refresh`, `DELETE /users/me`) 사용 상태를 `docs/service-architecture.md`에 반영한다.

## Out of Scope

- 소셜 계정 추가 연동·목록 화면, Android Apple 로그인, 약관/개인정보 동의 화면(서버 정책 없음 → DISC-001).
- 서버 변경, release 빌드·HTTPS 운영 주소.
