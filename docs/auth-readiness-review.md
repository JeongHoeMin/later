# Auth 기획 충족과 소셜 연동 준비 점검

2026-10-06 `feat/auth`, 구현 기준 `c940877`을 점검했다. 코드·문서·자동 테스트의 증거와 실제 제공자 계정/기기 검증을 구분한다. [서비스 정책](service-policy.md)은 변경하지 않았다.

## 기획과 구현 대조

| 요구                             | 현재 서버 상태                                                                                         | 근거                                                                                                                                                            |
| -------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MVP 가입/로그인                  | 검증한 소셜 계정으로 회원 조회·가입과 서비스 세션 발급 구현                                            | [소셜 로그인](../apps/api/src/auth/application/social-login.use-case.ts), [회원 연결](../apps/api/src/users/application/find-or-create-social-user.use-case.ts) |
| JWT/Refresh Token·현재 회원 식별 | JWT 발급·검증, 토큰 회전/재사용 탐지, `/auth/me`, DB 회원 존재 확인 구현                               | [세션 HTTP](../apps/api/src/auth/presentation/http/session.controller.ts), [현재 회원](../apps/api/src/auth/presentation/http/authenticated-user.controller.ts) |
| Google/Kakao/Naver/Apple 지원    | 네 어댑터와 Google/Kakao 공통 로그인, Naver start/callback/공통 완료, Apple start/nonce/공통 완료 구현 | [AuthModule](../apps/api/src/auth/auth.module.ts), [연동 절차](social-login-process.md)                                                                         |
| 로그아웃·탈퇴                    | 단일 세션 폐기 및 본인/자식 데이터 삭제 구현. 제공자 revoke는 정책상 미지원                            | [회원 HTTP](../apps/api/src/users/presentation/http/user-account.controller.ts), [서비스 정책](service-policy.md)                                               |
| 본인 소셜 목록·추가 연동         | Bearer로 목록/추가, 같은 제공자/다른 회원 충돌 보호, Apple/Naver 소유자 시도 구현                      | [연동 HTTP](../apps/api/src/auth/presentation/http/social-account-link.controller.ts)                                                                           |
| 현재 회원의 데이터 격리 기반     | 본인 API는 검증된 JWT 회원으로 처리. items/search/collections 격리는 해당 도메인 구현 시 필요          | [인증 Guard](../apps/api/src/auth/presentation/http/access-token.guard.ts)                                                                                      |

[기획 초안](서비스_기획_초안.md)의 인증 방식 미정과 `/auth/login`, `/auth/refresh`는 후속 소셜 결정/현재 경로로 보정했다. `User.email`은 초기 개념 모델에 있지만 현재 User에는 이메일 필드가 없고 `(provider, subject)`로 식별한다. 이메일 프로필/연락처가 필요하면 별도 정책·요구를 정해야 하며 현재 인증 성공의 필수 조건으로 해석하지 않았다.

[2차 기획](서비스_2차_기획_BM_및_장소_액션.md)의 구독·보관 제한·장소 액션은 별도 도메인 설계다. 해당 필드나 결제 로직이 auth에 없다는 이유로 auth 누락으로 분류하지 않는다. 새 도메인의 회원 소유권·탈퇴 처리·이용 권한은 해당 구현 시 정한다.

## 실제 로그인은 아직 검증 완료가 아님

이번 checkout의 `apps/api/.env`, `.env.test`는 없고 검사한 현재 셸의 DB/Redis·소셜·JWT·Naver bridge 설정도 없다. 비밀값을 출력하거나 개발/운영 DB에 접속하지 않았다. 다른 실행 환경이나 원격 배포 설정의 부재를 뜻하지는 않는다.

모바일 파일은 읽기만 확인했다. [App.tsx](../apps/mobile/App.tsx)의 로그인 handler는 `setIsLoggedIn(true)`로 화면만 전환한다. 제공자 SDK 호출·서버 로그인 요청·실제 서비스 토큰 보관/갱신은 이 진입 경로에 연결되어 있지 않다. [로그인 화면](../apps/mobile/src/features/auth/LoginScreen.tsx)은 Kakao/Apple/Google 세 버튼이고 Naver는 없다. [app.json](../apps/mobile/app.json)에 Naver 반환용 scheme과 iOS Bundle ID가 없으며 Android package는 기본값이다. 모바일 코드는 수정·빌드·기기 테스트하지 않았다.

따라서 **서버 자동 검증 통과를 실제 네 제공자 계정 로그인 성공으로 표현할 수 없다.** 외부 계정 동의·코드 발급·서버 HTTPS callback·앱 복귀·실제 토큰 저장까지의 성공 증거는 아직 없다. 문서의 Naver callback 콘솔 등록 기록도 실제 서버/앱 흐름 성공과 별개다.

## 실제 검증에 필요한 준비

1. 테스트용 API 환경에서 PostgreSQL/Redis/JWT 및 제공자 설정을 주입하고 migration과 실행 서버 `/docs-json` 버전을 확인한다. 테스트/운영 DB를 분리한다.
2. Google의 서버 audience와 앱 Client ID, Kakao 앱 ID, Apple Bundle/Services ID가 실제 앱/콘솔과 일치하는지 확인한다.
3. Naver client/secret·등록 callback·고정 app return URI·별도 bridge key를 설정하고 외부 HTTPS callback이 테스트 서버에 도달하도록 연결한다. 시도 ID/비밀값은 앱에서 보관하고 URL/로그로 노출하지 않는다.
4. 테스트 앱의 실제 로그인 handler, 앱 복귀, 서비스 토큰 보관 및 갱신 직렬화를 연결한다. 현재 세션의 서버 전용 범위에서 모바일 구현을 시작하지 않았다.
5. 각 제공자별 첫 로그인/재로그인·취소·로그아웃/갱신·기존 회원의 다른 제공자 추가·충돌·탈퇴 후 재가입을 실계정으로 확인한다. 비밀키/토큰은 채팅에 붙이지 않고 로컬 비밀 설정으로 전달한다.

이 목록은 준비/검증 절차이며 외부 콘솔·배포·실계정 생성 작업을 수행했다는 뜻이 아니다.

## 이번 검증

- Unit343개·HTTP E2E146개, 합계489개를 현재 코드로 재실행해 통과했다.
- 제공자 HTTP는 대체하며 JWT/Guard/Flow/DI/HTTP 계약은 실제 구현을 사용한다. 실제 제공자 계정·기기 로그인은 미검증이다.
- 이번 문서 점검에서는 DB integration을 재실행하지 않았다. 직전 구현의 DB60개 포함549개 통과 기록과 구분한다.
- 낡은 정리 주기 안내를 시작 즉시/5분 주기·bounded 배치로 보정했다. 새 auth 기능·정책·구성 변경은 없다.

서버 auth의 명시된 기능은 코드와 자동 테스트 기준으로 갖춰져 있다. 현재 우선 과제는 운영 수집기 추가가 아니라 테스트 환경/실제 로그인 연결을 준비해 실계정 경로를 검증하는 것이다.
