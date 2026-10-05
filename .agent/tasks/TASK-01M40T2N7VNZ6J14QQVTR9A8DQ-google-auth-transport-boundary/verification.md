# Verification

## RED / GREEN

- T-R1-1 / AC-R1-1, AC-R1-2: 최소 factory 선언 후 기존 SDK에서HTTP 자동 retry로 성공·통신/응답 오류의401 분류·malformed cache 오염을 기대 실패로 확인(/tmp/later-google-red-final.log). timeout 테스트는 fallback 후 정상 응답을 주어6초 뒤 성공하는 명확한 기대 실패를 확인(/tmp/later-google-timeout-red.log). 초기8초 runner timeout은 명시적 RED 근거에서 제외한다.
- 추가 RED: malformed 인증서 응답6종(PEM이 아닌 string 포함)이 기존401로 분류되어 기대503 도메인 오류 실패(/tmp/later-google-response-red.log).
- GREEN: 실제 SDK+HTTP경계 대체 unit24개 PASS(/tmp/later-google-green.log). actual native transport abort5초·HTTP/통신 retry없음·cache 적중·malformed 응답 후 정상 복구·서명/claims401 검증.
- T-R1-2 / AC-R1-2, AC-R1-3: google-login.e2e 실제NestDI/OAuth2Client/SDK/JWT로4개 PASS. HTTP503/network/malformed에서 회원·세션 접근 없음, 원문/토큰 비노출, 다음 정상 응답200, 잘못된JWT401. E2E는 구현 뒤 작성한 회귀이며 별도 RED로 주장하지 않는다. 기존 소셜 연동503 저장 전 실패도 전체Suite로 회귀 검증.

## Final Verification

- pnpm --config.verify-deps-before-run=false test:325 PASS, test:e2e:145 PASS, test:integration:60 PASS. /tmp/later-proxy-google-full-{unit,e2e,db}.log.
- exec tsc --noEmit --incremental false, exec eslint(변경 TS8개), build PASS. /tmp/later-proxy-google-{tsc,lint,build}.log.
- REFACTOR: N/A. 요구 동작의 최소 구현과 회귀 검증만 수행.
- 정책/구성 문서 코드 대조·로컬 링크·Task YAML/ID·git diff --check PASS.
- 실제 운영 Google/프록시·클라우드 부하·배포는 미실행. 임시 테스트 환경만 사용.
