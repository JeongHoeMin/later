# Verification

| Test | Requirement / AC | 실제 파일·Behavior |
| --- | --- | --- |
| T-R1-1 | AC-R1-3 | src/auth/infrastructure/rate-limit/prisma-auth-rate-limit.repository.integration-spec.ts: 두 저장소 동시 40요청 중 20허용, 포화 집계, 만료 초기화, 차단 창 보존, 키별 독립 |
| T-R1-2 | AC-R1-1,2,3 | test/auth-rate-limit.e2e-spec.ts: 20/60/10회 경계, 경로 그룹 공유/분리, 429/Retry-After, 60초 해제, 입력·인증 실패 소비, 차단 전 side effect 보호, 회원/IP 분리, DB 장애 원문 비노출 |
| T-R2-1 | AC-R2-1 | src/auth/infrastructure/rate-limit/client-ip.spec.ts: IPv4/mapped IPv6/IPv6 정규화·오류·명시 CIDR 허용·잘못된 설정 거부; 새 HTTP 테스트: 미신뢰 전달 IP 우회 차단·명시 프록시 신뢰 후 회원 제한 유지 |
| T-R2-2 | AC-R2-2 | 새 실제 DB 테스트: 만료 카운터 배치 정리·유효 카운터 보존; 새 HTTP 테스트: 경로별 OpenAPI 429/Retry-After; migration SQL 확인 |

RED: PASS. IP Unit 16실패/1기존 PASS, 새 HTTP 10실패, DB 4실패. 허용 과다·정규화/설정 검증 누락·저장/삭제 누락 등 기대 동작 실패 확인. 최초 잘못된 실행 디렉터리 및 Kakao 테스트 ENV 누락은 환경 오류로 구분하고 RED에 포함하지 않는다.
GREEN: PASS. 대상 Unit17, HTTP10, 실제 DB4개 통과.
REFACTOR: N/A. 불필요한 기능 리팩터링 없음; 변경 파일 포맷 정리.

전체 API: Unit287/25파일, E2E138/15파일, Integration46/10파일 PASS. E2E 최초 실행에서 세 기존 Suite의 카운터가 테스트 사이에 누적되어 15실패했다. TestAuthRateLimitRepository를 테스트별 초기화한 뒤 전체138개 통과. Guard 우회나 정책 완화 없음. 기존 Vite 경고는 테스트 실패와 구분한다.

최종 Unit287/25파일, E2E141/15파일, Integration47/10파일(총475개) PASS. tsc, 변경 TS34파일 eslint, build, Prisma validate, migrate diff(차이 없음), git diff --check PASS. 문서 로컬 링크46개 확인. migration은 격리 later_test에만 적용, 기존 테이블 수정·데이터 삭제 없음. 개발/운영 DB 및 모바일 변경 없음.

## Service Policy Verification

docs/service-policy.md의 로그인/시작/callback 20회 공유, 갱신/로그아웃 별도60회, 연동 IP/회원 각각10회, 첫 요청60초, 실패 소비·창 미연장·저장소 실패·프록시 설정·카운터 정리를 코드 및 테스트와 대조한다.


## Review Regression / Final Result
독립 리뷰의 중요 결함: 서버 시각이 DB보다 앞서면 활성 제한 창을 정리할 수 있었다. 재현 과정에서 한국 시간대의 naive timestamp 저장이9시간 오프셋을 만드는 점도 확인했다. 실제 DB 만료 상한 및 미래 cutoff 테스트가2실패/3PASS인 RED를 확인한 뒤 SQL을 DB UTC 기준으로 변경했다. 정리는 서버 기준 시각과 DB UTC 중 이른 값을 사용한다. GREEN5개 통과, 이후 전체 DB47개 통과. 미래 cutoff 테스트는 rollback-only 실제 SQL 트랜잭션으로 다른 테스트 데이터를 보존한다.

독립 재리뷰에서 중요 결함 해결 및 추가 중요 결함 없음 확인. 리뷰 제안의 동일 IP 다른 회원 예산 공유, mapped IPv6의 실제 Guard 카운터 공유, 갱신/로그아웃 독립성 HTTP3개를 추가했다. 이미 구현된 동작의 회귀 검증이라 별도 RED를 주장하지 않는다.

정책 문서의 수치·창·프록시·차단/장애 응답·UTC 정리를 코드와 대조 완료. migration은 새 테이블/인덱스 생성만 포함하며 개발/운영 DB 변경 없음. 새 정책 기준 문서를 구현 커밋에 포함한다.
