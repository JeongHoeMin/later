# Progress

## Current State

2026-10-06 사용자 요청: "docs 개발·기획 문서와 `/docs-json`을 확인해 모바일 소셜 로그인/회원가입 MVP를 뽑고 남은 개발을 진행". 이 세션은 모바일만 다룬다. 요청 자체를 범위 승인으로 보고 requirement.md의 MVP(M3~M5)를 진행했다.
R1~R4 구현과 단위 테스트 GREEN(80/80), tsc·eslint PASS. 실제 기기 수동 확인만 남았다.

## Completed

- MVP 정리: 서버에 별도 가입 API·약관·프로필 입력이 없어 첫 소셜 로그인 = 가입. 남은 MVP는 앱 복원·자동 갱신·회원 탈퇴.
- 사용자 요청으로 `apps/mobile/.env.local`과 잘못 놓인 `apps/mobile/src/.env.local`(둘 다 git ignore 대상)을 삭제했다. 앱을 실행하려면 `.env.example`을 복사해 `.env.local`을 다시 만들어야 한다.
- T-R1~R4 RED → GREEN. 서버 오류 계약 실측 대조(T-CONTRACT-1).
- 정책·구성 문서 갱신.
- 사용자 요청으로 `apps/mobile/.env.example`을 코드가 실제로 읽는 4개 변수(API 주소, 카카오 네이티브 앱 키, Google 웹·iOS 클라이언트 ID)만 남기고 발급 위치·서버 값과의 관계를 주석으로 정리했다. 네이버·Apple은 앱 변수가 없음을 명시했다. 문서 변경이라 TDD 예외, 코드의 `process.env` 사용처와 대조해 검증했다.

## Decisions

- Decision: 앱 복원은 저장된 Access Token으로 `GET /auth/me`를 먼저 호출하고 401이면 갱신한다. Reason: 15분 내 재실행은 갱신 없이 복원되어 Refresh Token 회전·요청 제한(갱신 IP 60회/분) 소비를 줄인다. 갱신 응답에는 user가 없어 어차피 `/auth/me`가 필요하다.
- Decision: 갱신은 모듈 단위 single-flight로 직렬화한다. Reason: 같은 Refresh Token을 동시에 쓰면 서버가 재사용으로 보고 세션을 폐기한다.
- Decision: 갱신 401·재시도 401만 세션 만료로 보고 토큰을 지운다. 네트워크·5xx·429는 토큰을 유지한다. Reason: 일시 장애로 사용자를 로그아웃시키지 않는다.
- Decision: 기존 Access Token의 SecureStore 저장(부모 Task AC-R5-1)은 유지했다. Alternatives: 메모리만 보관(취소된 mobile-auth-session Task 설계). Reason: 저장해 두면 위 복원 결정처럼 재실행 시 갱신을 생략할 수 있고, 기존 검증된 동작을 바꾸지 않는다.
- Decision: 탈퇴 버튼은 현재 홈(SharePocScreen)의 `AccountActions` 컴포넌트에 둔다. Reason: 설정 화면이 아직 없다. 화면 구성이 생기면 컴포넌트만 옮긴다.
- Decision: Expo Router로 전환하지 않았다. Reason: 앱이 `App.tsx` 단일 진입으로 구성되어 있고 라우터 도입은 MVP 인증 범위 밖이다. `apps/mobile/AGENTS.md`의 Expo Router 지침과 충돌하므로 기록한다(DISC-002).

## Issues / Blocker

- 실제 기기 확인은 Agent 환경 Gradle 제약으로 사용자 터미널에서 수행해야 한다(부모 Task와 같음).
- 2026-10-06 사용자 요청으로 수동 확인 전에 부모 Task 2건과 함께 한 커밋으로 커밋했다(파일이 서로 얽혀 분리 불가). `pnpm-workspace.yaml`은 사용자가 설치 문제를 해결한 변경이며 서버 빌드 허용 결정이 포함되어 커밋에서 제외했다.

## Discovered Requirements

- DISC-001 / NEEDS_CONFIRMATION: 로그인 화면의 이용약관·개인정보처리방침 링크 대상(URL/화면)이 없다. 스토어 출시 전 문서 URL이 필요하다.
- DISC-002 / NEEDS_CONFIRMATION: Expo Router 도입 시점(설정·목록 화면이 늘어날 때 함께 전환 제안).

## Failed Attempts

- 테스트 보조 mock을 `__tests__`에 두었더니 jest가 테스트 파일로 인식할 수 있어 `session/__testing__/`으로 옮겼다.

## Next Action

T-MANUAL-1: 사용자 터미널에서 `apps/mobile/.env.local`을 다시 만든 뒤 `pnpm dev:android`로 로그인 → 앱 재시작(홈 유지) → 서버 중지 후 재시작(재시도 화면) → 탈퇴(로그인 화면)를 확인하고 verification.md를 갱신한다. 부모 Task 수동 로그인 확인과 함께 수행한다. 결과 기록은 별도 커밋으로 남긴다.
