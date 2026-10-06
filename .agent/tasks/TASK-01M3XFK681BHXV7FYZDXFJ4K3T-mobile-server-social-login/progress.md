# Progress

## Current State

2026-10-02 사용자 승인: 서버 계약 문서(feat/auth, 네이버 브리지 포함) 기준으로 진행, 세션은 토큰 저장 + 로그아웃, 앱 복원은 다음 Task, API 주소는 `EXPO_PUBLIC_API_BASE_URL=http://19.19.20.49:3000`.
R1~R6 구현 완료, 단위 테스트 GREEN. 실제 서버 대상 수동 로그인만 남았다.

## Completed

- 서버 계약 확인: 붙여 준 문서, `origin/feat/auth`의 `naver-login-settings.ts`(앱 반환 URL 규칙), `/docs-json`(작업 시작 시 서버 재시작 중으로 응답 없음, 이전 조회분 사용).

- T-R1~R6 RED → GREEN. 패키지: expo-secure-store, expo-web-browser 추가, @react-native-seoul/naver-login 제거.
- 앱 `.env.local`에 `EXPO_PUBLIC_API_BASE_URL` 추가(사용자 요청 값). 네이버 키 항목은 더 이상 쓰지 않는다.

- 2026-10-02 계약 변경 반영: 네이버 최종 로그인을 `/auth/social/naver/complete`에서 `POST /auth/social/login` + `provider: 'naver'`로 변경. 실행 서버가 응답하지 않아 `/docs-json` 대신 서버 소스(`origin/feat/auth` `bef5200`, `social-login-request.pipe.ts`)로 본문 규칙(시도 ID UUID, attemptSecret 43자 base64url, 추가 필드 금지)을 확인했다.

- 2026-10-06 사용자 요청으로 origin/main(`c6605e6`, feat/auth PR #10 포함)을 로컬 main과 feat/mobile/auth에 fast-forward로 반영했다. 미커밋 작업은 stash 후 다시 적용했다. `pnpm-workspace.yaml`은 양쪽 allowBuilds 항목을 합쳤고, `pnpm-lock.yaml`은 main 기준으로 `pnpm install` 재생성했다. 반영 후 `pnpm test` 55/55, `tsc` PASS.
- main에서 들어온 모바일 Task 2건(`mobile-auth-api-client`, `mobile-auth-session`)은 cancelled 기록이며 이 Task와 충돌하지 않는다. 다음 앱 복원 Task에서 `mobile-auth-session`의 설계(access token은 메모리 보관, 저장 성공 후 로그인 게시)를 참고한다.

## In Progress

실제 서버 대상 수동 로그인 확인.

## Remaining

수동 로그인(카카오·구글·네이버), 결과 기록. 코드는 2026-10-06 사용자 요청으로 하위 Task(TASK-01M47BZNY8K3J46ETXA7GTD26M)와 함께 커밋했다.

## Decisions

- Decision: 앱 스킴 `kr.pe.hoe.later`, 네이버 반환 URL `kr.pe.hoe.later://auth/naver`. Reason: 서버 규칙(https 또는 허용 커스텀 스킴, host 필수, query 금지)을 만족하고 번들 ID 기반이라 다른 앱과 충돌 가능성이 낮다. 서버 `NAVER_LOGIN_APP_RETURN_URL`에 같은 값을 설정해야 한다.
- Decision: 네이버는 expo-web-browser `openAuthSessionAsync`로 서버 authorizationUrl을 연다. Reason: iOS ASWebAuthenticationSession·Android Custom Tabs에서 반환 딥링크를 해당 세션 결과로만 받는다.
- Decision: Apple nonce는 해시 없이 전달. Reason: expo-apple-authentication iOS 구현이 `request.nonce = options.nonce`로 그대로 전달한다.
- Decision: API 오류 매핑은 401→rejected(새 로그인), 400→failed, 그 외 5xx·네트워크·시간 초과(15초)→unavailable. Reason: 서버 오류 표의 모바일 처리 기준.
- Decision: 로그아웃은 API 실패와 관계없이 로컬 토큰을 삭제한다. Reason: 사용자의 로그아웃 의도를 우선한다. 서버 세션은 만료(30일)까지 남을 수 있다.

## Issues / Blocker

- `pnpm install`이 `ERR_PNPM_IGNORED_BUILDS`(@prisma/engines, prisma, @scarf/scarf)로 끝난다. main의 `pnpm-workspace.yaml`이 prisma 항목을 미정(`set this to true or false`)으로 둔 상태다. 서버 담당 결정 사항이라 변경하지 않았다. lockfile과 모바일 의존성 설치는 반영되었다.

- 개발 서버(`http://19.19.20.49:3000`)가 작업 중 응답하지 않았다(HTTP 000). Required To Resume: 서버를 다시 띄운 뒤 `/docs-json`에 네이버 start/callback 경로와 `/auth/social/login`의 naver 형식이 있는지 확인한다.
- Gradle 빌드는 Agent 환경 loopback 오류로 불가하다(부모 Task와 같음). 사용자 터미널에서 `pnpm dev:android`를 실행해야 한다.

- 서버 측 설정 필요: `NAVER_LOGIN_APP_RETURN_URL=kr.pe.hoe.later://auth/naver`, `NAVER_LOGIN_BRIDGE_KEY`, Callback `https://later.hoe.pe.kr/...`이 개발 서버로 연결되어야 실제 네이버 로그인 확인 가능.

## Discovered Requirements

없음.

## Failed Attempts

없음.

## Next Action

T-R4-2/T-R6-2: 서버 기동 후 사용자 터미널에서 `pnpm dev:android`를 실행해 카카오·구글·네이버 로그인과 로그아웃을 확인한다. 네이버는 서버 `NAVER_LOGIN_APP_RETURN_URL=kr.pe.hoe.later://auth/naver`, `NAVER_LOGIN_BRIDGE_KEY`, 그리고 Callback 도메인이 이 서버로 연결되어 있어야 한다. 결과를 verification.md에 기록한다.
