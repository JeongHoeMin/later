# Verification

| Test   | AC        | 실제 테스트                                                         | RED  | GREEN | Result |
| ------ | --------- | ------------------------------------------------------------------- | ---- | ----- | ------ |
| T-R1-1 | AC-R1-1~2 | openapi.e2e-spec.ts 제공자 oneOf·필수/추가 필드·무본문·refresh 요청 | PASS | PASS  | PASS   |
| T-R2-1 | AC-R2-1~2 | 같은 파일의 성공/오류 응답·미인증 요구·실제 기본 GET content type   | PASS | PASS  | PASS   |
| T-R3-1 | AC-R3-1   | 문서 예시·정규식·필수 필드 삭제·추가 필드를 실제 Pipe와 대조        | N/A  | PASS  | PASS   |

RED: 기존 문서에 requestBody·SocialLoginResponseDto가 없어 2개 assertion 기대 실패. T-R3는 기존 Pipe 동작을 대조하는 회귀 보호망으로 처음부터 PASS여서 RED로 기록하지 않는다.
GREEN: 문서 E2E 5개 PASS. 전체 API Unit 230/23파일, E2E 77/9파일, Integration 23/6파일 PASS. tsc·변경 TS eslint·Nest build PASS.
REFACTOR: 기존 Apple UUID 정규식을 source 문자열 상수로 공유, 허용 범위를 보존하고 전체 unit/E2E PASS 확인.
리뷰: fresh reviewer 수정 필요 finding 없음, 문서 E2E 5개 별도 PASS. 첫 reviewer sandbox spawn EPERM은 환경 시작 오류이며 RED가 아니다.
문서 준비 TDD N/A. YAML·링크·포맷·diff 확인. 실제 외부 제공자 로그인·네트워크 배포는 수행하지 않았다.
