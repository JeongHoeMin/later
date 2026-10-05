# Verification

## RED / GREEN

- T-R1-1 / AC-R1-1: RED8개 PASS. mapped /96, dotted/fulluppercase/hostbits/넓은prefix 등8종이 기존 검증에서 거부되지 않아 기대 실패(/tmp/later-proxy-red.log).
- GREEN: client-ip unit31개 PASS(/tmp/later-proxy-green.log). 좁은 mapped /120,/128,/97 및 mapped전체를 포함하지 않는IPv6 허용은 기존 동작 회귀로 구분한다.
- T-R1-2 / AC-R1-2: 실제 Nest HTTP IP 예산 테스트에서 신뢰 peer를 mapped127.0.0.1/128로 설정하고 기존 회원별/IP별 공유와 IPv4/mapped 동일 카운터 회귀 PASS. 실제 운영 프록시 설정은 미확인.

## Final Verification

- pnpm --config.verify-deps-before-run=false test:325 PASS, test:e2e:145 PASS, test:integration:60 PASS. /tmp/later-proxy-google-full-{unit,e2e,db}.log.
- exec tsc --noEmit --incremental false, exec eslint(변경 TS8개), build PASS. /tmp/later-proxy-google-{tsc,lint,build}.log.
- REFACTOR: N/A. 요구 동작의 최소 구현과 회귀 검증만 수행.
- 정책/구성 문서 코드 대조·로컬 링크·Task YAML/ID·git diff --check PASS.
- 실제 운영 Google/프록시·클라우드 부하·배포는 미실행. 임시 테스트 환경만 사용.
