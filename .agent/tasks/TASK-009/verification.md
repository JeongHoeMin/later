# Verification

아래는 구현 전 테스트 설계 초안이다. 공식 계약과 사용자 승인 후 실제 사례·파일·테스트 이름을 확정한다.

| Test   | AC               | Behavior                                                                                      | Type            | RED         | GREEN       | REFACTOR    | Result      |
| ------ | ---------------- | --------------------------------------------------------------------------------------------- | --------------- | ----------- | ----------- | ----------- | ----------- |
| T-R1-1 | AC-R1-1, AC-R1-2 | 유효한 우리 앱 인증 정보로 검증된 네이버 subject를 반환하고 다른 앱·위조·만료 정보를 거부한다 | UNIT / CONTRACT | NOT_STARTED | NOT_STARTED | NOT_STARTED | NOT_STARTED |
| T-R1-2 | AC-R1-3          | 응답 오류·외부 장애·네트워크·timeout을 인증 실패와 구분하고 credential을 숨긴다               | UNIT            | NOT_STARTED | NOT_STARTED | NOT_STARTED | NOT_STARTED |
| T-R2-1 | AC-R2-1, AC-R2-2 | 설정 검증과 DI, 네이버 회원 연결 및 기존 제공자 회귀                                          | UNIT            | NOT_STARTED | NOT_STARTED | NOT_STARTED | NOT_STARTED |
| T-R3-1 | AC-R3-1, AC-R3-2 | provider 보존, 신규·기존 회원의 서비스 토큰 발급, 입력·인증·장애 오류와 저장 차단             | UNIT + E2E      | NOT_STARTED | NOT_STARTED | NOT_STARTED | NOT_STARTED |

## 예정 테스트 위치

- apps/api/src/auth/infrastructure/naver/naver-auth-provider.spec.ts (아직 없음)
- apps/api/src/auth/auth.module.spec.ts
- apps/api/src/auth/presentation/http/social-login-request.pipe.spec.ts
- apps/api/test/naver-login.e2e-spec.ts (아직 없음)

외부 HTTP 경계만 대체하고 실제 어댑터·유스케이스·Nest HTTP·JWT 로직을 검증한다. 기존 DB 통합 Suite로 저장·동시성 회귀를 확인한다.

## Final Verification

구현은 미시작이며 테스트를 실행하지 않았다. Task 준비 자체는 네 파일·YAML·상태·R/AC/Test 연결·포맷·diff로 검증한다.
구현 완료 전 apps/api의 Unit/E2E/Integration, 타입·변경 파일 lint·build를 실행하고 실제 결과를 기록한다.
실제 네이버 앱·토큰·모바일 수동 로그인은 자동화 검증과 구분한다. 실행하지 않은 검증을 PASS로 기록하지 않는다.

## 확인할 공식 문서

[네이버 로그인 API](https://developers.naver.com/docs/login/api/api.md). 아직 이 Task에서 외부 계약을 확인하지 않았다. URL 내용을 읽고 현재 계약을 근거로 설계를 확정한다.
