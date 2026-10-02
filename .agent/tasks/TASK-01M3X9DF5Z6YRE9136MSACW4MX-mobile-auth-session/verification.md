# Verification

T-R1-1 login 저장/실패; T-R1-2 restore 검증/회전: NOT_STARTED.
T-R2-1 expiry/single flight/logout race; T-R2-2 invalid401/network/logout; T-R2-3 persistence failure: NOT_STARTED.
SecureStore adapter: native 경계를 mock하고 저장/조회/삭제와 옵션 검증.

AC 연결: R1-1 로그인 metadata 저장/저장 실패; R1-2 empty/verify restore+rotation; R2-1 concurrent expiry, logout boundary, delayed storage expiry; R2-2 invalid401/network/logout failure and in-flight rotation; R2-3 persistence revoke/clear. auth-session.spec.ts12개 PASS.
SecureSessionStore.spec.ts7개 PASS: write options, read, invalid records3종, clear, native failure mask.
전체 auth-api-client21 + session12 + store7 =40 PASS. 모바일 tsc/lint PASS. Expo Android export PASS(현재 App 진입점만, 새 세션은 다음 Task에서 조립). native 기기 실행 N/A. 리뷰 P2 두 문제와 자체 발견 race는 실제 RED 후 수정. Refactor 후 전체 재검증 PASS.
