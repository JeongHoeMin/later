# Auth 운영 위험 점검

2026-10-03 `feat/auth` 코드와 설치된 라이브러리를 점검했다. 운영 DB/클라우드/프록시에는 접속하지 않았고 실제 트래픽·월 비용을 측정하지 않았다. 아래 수치는 가정을 둔 용량 계산이며 청구액이나 부하 테스트 결과가 아니다. Redis 구성 추가는 사용자 승인을 받아 별도 Task로 구현했다. 후속 승인으로 정리 처리량·인덱스·프록시 범위 검증·Google 통신 경계도 개선했으며 아래에서 초기 발견과 현재 상태를 구분한다. 서비스 정책의 기준은 [service-policy.md](service-policy.md)다.

## 우선순위와 상태

| 우선순위             | 문제                                                | 현재 상태 / 권고                                                                                                         |
| -------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 높음                 | 차단 요청도 PostgreSQL 쓰기/행 잠금 발생            | 이번 Redis 전환으로 live 경로에서 제거. Redis 앞단 전체 요청 제한은 여전히 필요                                          |
| 높음 · 처리량 조건부 | 만료 데이터 정리가 유입량을 따라가지 못함           | Redis 키는 TTL로 해결. 로그인 시도/세션도 즉시·5분 주기와 bounded 반복으로 개선. backlog 지표와 cascade 비용은 후속 과제 |
| 중간                 | 만료 세션과 연동 시도 FK의 인덱스 누락              | 인덱스3개 추가 및 테스트 DB migration/EXPLAIN 검증 완료. 운영 미적용                                                     |
| 중간                 | 사용 완료 Refresh Token·세션 누적과 큰 cascade 삭제 | 세션 수/갱신 빈도/보존 용량 측정, 갱신 남용 제한 및 삭제 배치 전략 권고                                                  |
| 중간                 | 전체 IPv4를 신뢰하는 mapped IPv6 설정이 검증 통과   | 전체 mapped IPv4 포함 IPv6 CIDR 거부 구현 및 단위/HTTP 회귀 완료. 실제 프록시 배포 설정은 미확인                         |
| 중간                 | Google 인증서 통신 deadline 및 장애 구분 부족       | 5초 timeout·자동 retry0·인증서 장애503 분류와 cache 유지 구현/검증 완료                                                  |
| 배포 전 확인         | IP 예산 공유, Redis 장애, DB pool/관측/재인증 정책  | 아래 적용 조건을 확인할 필요가 있음                                                                                      |

## 1. 요청 제한이 DB 부하를 막지 못하던 구조 — 이번 변경으로 해소

기존 [PostgreSQL limiter](../apps/api/src/auth/infrastructure/rate-limit/prisma-auth-rate-limit.repository.ts:14)는 모든 요청에 `INSERT ... ON CONFLICT DO UPDATE`를 수행했다. 값이 포화해도 UPDATE 자체를 건너뛰지 않아429 요청도 DB 쓰기와 같은 키 행 잠금을 유발했다. 외부 소셜 인증 호출은 차단하지만 DB 앞단의 요청량은 줄이지 못했다.

가령 Guard에 초당1,000요청이 도달하면 제한 때문에 대부분 실패해도 하루86,400,000번의 UPSERT가 발생하는 구조였다. 이는 공격 또는 트래픽 가정에 대한 연산 수이며 DB 비용 금액은 아니다. 정상 회원 DB와 공유하므로 지연/연결 고갈 위험도 있다.

현재 DI는 [Redis limiter](../apps/api/src/auth/infrastructure/rate-limit/redis-auth-rate-limit.repository.ts)로 변경했다. Lua로 원자 판정하며 한도 초과 후에는 조회만 하고 증가하지 않는다. 키는60초 TTL로 자동 제거된다. 이전 DB 테이블/migration은 보존하지만 새 요청은 사용하지 않는다. 회원·세션 데이터는 PostgreSQL에 유지한다.

Redis는 새 인스턴스/운영 비용을 추가한다. 요청당 Redis 연산 자체는 남으므로 프록시/게이트웨이의 전체 요청·동시 연결 제한, Redis CPU/메모리/latency 지표가 필요하다. 도입이 월 비용 감소를 실측했다는 뜻은 아니다.

## 2. 정리 처리량과 재시작 — 후속 개선

초기 점검 당시 [정리 유스케이스](../apps/api/src/auth/application/cleanup-expired-auth.use-case.ts)는 배치500개를 한 번만 처리하고 [scheduler](../apps/api/src/auth/infrastructure/cleanup/auth-cleanup.scheduler.ts)는 시작1시간 후부터 매시간 실행했다.

이전 방식에서는 프로세스1개가 계속 실행되어 매번 성공하면 테이블별 최대12,000개/day를 삭제했다. 만료 유입이3,600개/hour이고 다른 실행 인스턴스가 없는 조건이면 backlog는 최소3,100개/hour씩 늘 수 있다. Redis 키에는 이제 이 문제가 없지만 Apple/Naver 시작 요청으로 생긴 행과 세션은 대상이다. 초기 정리를 수행하기 전에 프로세스가 계속 재시작되면 한 번도 정리되지 않는다.

현재는 시작 즉시와5분마다 실행하고 최대10배치·배치당500개를 처리한다. 동일 cutoff와 배치 사이 단조 시각10초 예산을 사용한다. 모든 테이블이 배치를 채우지 않으면 조기 종료한다. 성공 로그에 batches/limitReached를 추가했으며 배치별 커밋으로 이전 성공을 보존한다. 이론상 테이블별 최대60,000개/hour지만 실제 DB 시간·잠금·cascade 비용에 따라 낮아지므로 처리량 보장은 아니다. 오래된 만료 데이터 수·최대 만료 지연·실패 연속 횟수를 기록한다. 사용 완료 토큰의 조기 삭제는 재사용 탐지를 깨뜨릴 수 있으므로 보존 정책을 유지하며 설계한다.

## 3. 누락된 인덱스 — 추가 완료, 운영 미적용

[스키마](../apps/api/prisma/schema.prisma:62)의 AuthSession에는 초기 점검 당시 userId 인덱스만 있었고, 정리는 expiresAt 필터와 expiresAt/id 정렬을 사용한다. `(expiresAt,id)` 인덱스가 이 접근에 맞는다. 실제 운영 실행 계획과 latency는 측정하지 않았지만 큰 테이블에서 전체 검사/정렬 위험이 있다.

Apple/Naver의 ownerUserId는 회원 탈퇴 cascade FK지만 [연동 migration](../apps/api/prisma/migrations/20261003073000_user_social_account_link/migration.sql)에 해당 인덱스가 없다. PostgreSQL은 참조측 FK 인덱스를 자동 생성하지 않는다. 로그인 시도 테이블이 크면 본인 연동 시도가 없어도 회원 삭제 시 해당 참조를 찾는 비용이 늘 수 있다. 각 ownerUserId 인덱스를 추가했다. SocialAccount.userId, AuthSession.userId, RefreshToken.sessionId는 이미 인덱스가 있다.

[추가 migration](../apps/api/prisma/migrations/20261003103330_auth_cleanup_indexes/migration.sql)으로 세 인덱스를 격리 later_test에 적용했다. 카탈로그 유효성과 seqscan을 테스트 트랜잭션에서 껐을 때 실제 쿼리가 해당 인덱스를 사용하는 EXPLAIN을 확인했다. 작은 테스트 테이블에서 인덱스 사용 가능성을 검증한 것이며 운영 속도 향상을 실측한 것은 아니다. 일반 CREATE INDEX는 생성 중 쓰기를 막을 수 있어 운영 적용 전 데이터량과 작업 시간을 검토해야 한다.

## 4. Refresh Token 보존·세션 누적 — 용량과 삭제 비용

[회전 저장소](../apps/api/src/auth/infrastructure/persistence/prisma-auth-session.repository.ts:52)는 성공마다 기존 토큰의 usedAt을 기록하고 새 토큰을 추가한다. 재사용 탐지를 위해 이전 행을 유지하고 세션은 최초30일 동안 보존한다. 회원별 세션 수 상한과 성공 갱신 최소 간격은 현재 없다.

한 세션을30일간15분마다 갱신하면 약2,881개 토큰 행이 필요하다. 활성 세션10,000개가 이 방식으로 계속 사용된다는 가정이면 약2,881만개 행이다. 실제 사용 시간이 짧으면 이보다 적다. IP당60회/min 제한은 정상·유효 토큰의 과도한 갱신 자체를 충분히 억제하지 못하며, IP를 바꾸면 회원별 갱신 제한도 없다.

만료 세션500개를 지워도 cascade 대상 토큰은500개로 제한되지 않는다. 위15분 갱신 조건의 세션500개는 약144만개 토큰을 한 트랜잭션에서 삭제할 수 있다. 정리의 한 배치가 한 트랜잭션이므로 큰 세션 cascade의 실패가 해당 배치의 Apple/Naver 정리도 rollback할 수 있다. 이전 성공 배치는 유지된다. 탈퇴도 같은 자식 행 수의 영향을 받는다.

권고: 세션별 갱신 빈도/토큰 수·회원별 활성 세션 수를 측정하고 비정상 갱신 남용 보호 및 삭제 전략을 설계한다. 단순히 사용 완료 토큰을 지우거나 정상 사용자 갱신을 거절하면 현재 보안/앱 복원 정책을 바꾸므로 별도 Task와 정책 갱신이 필요하다.

## 5. 프록시 설정 검증 우회 — 수정 완료

초기 [설정 검증](../apps/api/src/auth/infrastructure/rate-limit/client-ip.ts)은 IPv6 prefix1~128을 허용하여 `::ffff:0:0/96`을 통과시킨다. Express의 proxy-addr는 이 범위를 모든 IPv4 peer에 대한 신뢰로 해석한다. 현재 설치 코드로 검증기에 해당 설정을 전달하고 `proxy-addr.compile` 결과가 임의 IPv4 `203.0.113.10`을 신뢰함을 읽기 전용 probe로 재현했다.

이 설정을 쓰고 외부에서 API에 직접 연결할 수 있으면 X-Forwarded-For를 임의로 바꿔 IP 예산을 우회할 수 있다. 운영이 실제로 이 설정이라는 근거는 없다. 현재 검증은 canonical IPv6를128비트 prefix로 비교하여 mapped IPv4 전체를 포함하는 CIDR을 거부한다. 압축/대소문자/IPv4 표현·host bits·더 넓은 IPv6 범위를 포함한8개 우회 사례를 차단했다. 좁은 mapped CIDR 허용과 실제 HTTP IP 예산 회귀도 검증했다. 운영에는 실제 프록시의 정확한 IP/CIDR만 등록해야 한다.

## 6. 소셜 제공자 지연과 오류 분류

Kakao는 인증 때 token info와 user profile을 순차 호출하고 각각5초 제한이다. Naver는 code exchange와 profile을 각각5초 제한으로 호출한다. API 인스턴스별 제공자 검증 동시 상한 기본10개를 추가했지만 fleet 전체 제한/circuit breaker는 없다. 여러 IP에서 허용 예산을 소비하면 제공자 지연 동안 동시 대기 요청과 연결이 늘 수 있다. 실제 앞단의 연결 제한 설정은 확인하지 않았다.

[Google provider](../apps/api/src/auth/infrastructure/google/google-auth-provider.ts:22)는 verifyIdToken을 사용한다. 설치된 google-auth-library11.1.0은 인증서를 Cache-Control max-age 동안 재사용하므로 매 로그인마다 외부 호출하는 구조는 아니다. 초기 구현은 인증서 GET에 명시 timeout이 없고 재시도가 켜져 있었으며 통신 실패까지401로 바꿨다. 현재 [Google client factory](../apps/api/src/auth/infrastructure/google/google-oauth-client.ts)는 HTTP5초 timeout과 retry0을 적용한다. 응답 인증서 형태/공개키를 SDK cache 저장 전에 검증하여 잘못된 응답 뒤 재시도로 복구할 수 있다. 통신/HTTP/응답 장애는503, JWT/서명/claims 실패는401로 구분한다. 실제 SDK와 HTTP 경계 대체 테스트로 native5초 취소·재시도 없음·cache·회복·Nest DI/HTTP/저장 전 실패를 검증했다. 운영 Google 네트워크의 실제 지연은 미측정이며 API 인스턴스별·제공자별 동시 검증 상한 기본10개와5분 집계 지표를 추가했다. fleet 전체 동시성·circuit breaker는 후속 과제다.

Apple의 JWKS client는 provider instance에 유지되고5초 네트워크 제한을 설정한다. 캐시 때문에 인증마다 JWKS를 다시 받는다고 판단하지 않았다. 실제 제공자 계정/네트워크에 대한 부하 시험은 하지 않았다.

## 7. 운영 정책과 배포 전 확인 사항

- **공용 IP:** 로그인20회 예산은 start/callback/complete가 공유한다. Naver 로그인 한 흐름은 통상3번 소비한다. 같은 공용 IP에서 완료 흐름6개는18회를 소비하고7번째는 중간에429가 될 수 있다. 제공자 혼용·학교/회사/통신사 NAT도 공유한다. 실제 프록시 신뢰 설정이 없으면 서버 앞의 프록시IP 하나로 전체 사용자가 예산을 공유할 수 있다. 수치 튜닝과 callback 독립 예산을 검토한다.
- **Redis 장애:** 새 Redis에 연결하지 못하면 API가 시작되지 않는다. 런타임 장애는 로그인/갱신/로그아웃/연동을500으로 실패시킨다. 이미 떠 있는 서버의 다른 읽기 API에 직접 이 limiter를 적용한 것은 아니다. Redis 가용성·readiness/경보가 필요하며 일반 GET /의 정상 응답이 인증 저장소 정상 여부를 보장하지 않는다.
- **DB 연결 예산:** PrismaModule은 adapter에 connectionString만 제공한다. pool/대기/statement·lock timeout과 인스턴스 수를 합친 DB 연결 예산을 운영 환경에서 확인해야 한다. 코드에 명시되지 않았다고 라이브러리 기본 timeout이 없다고 단정하지 않는다.
- **회원 존재 조회:** 유효한 보호 API마다 회원 존재 DB 조회가1회 들어간다. 서비스 API가 늘면 비용도 전체 보호 요청량에 비례한다. 이것이 탈퇴 JWT를 즉시 거부하는 정책을 제공하므로 단순 캐시는 삭제 정책과 함께 검토해야 한다.
- **관측:** 자체 logger는 민감 본문/query/토큰을 기록하지 않는다. Observe instrumentation은 활성화 코드와 placeholder 설정이 있고 설치 SDK의 기본 redactor도 있지만 실제 샘플링/수집/보존·프록시 로그 설정은 확인되지 않았다. 정상 Guard 통과 요청의 자체 started/terminal 로그2개와 별도 trace 비용을 운영 트래픽으로 산정하고 code/state/credential의 수집 여부를 테스트해야 한다. 실제 비밀 유출을 확인한 것은 아니다.
- **Access Token:** 로그아웃/재사용 탐지 후 기존 JWT는 최대 남은15분 유효하다. 탈퇴는 이후 회원 존재 조회에서 거부한다. 현재 명시 정책이며 구현 결함으로 분류하지 않았다. 더 빠른 폐기를 원하면 세션 조회/캐시/취소 정책 변경이 필요하다.
- **갱신 중복/응답 유실:** 같은 Refresh Token을 동시에 보내거나 성공 응답을 잃고 재전송하면 세션이 폐기될 수 있다. 현재 엄격한 재사용 탐지 정책이다. 모바일 갱신 직렬화와 네트워크 실패 UX를 검증한다.
- **민감 작업 재인증:** 탈퇴·소셜 계정 추가에는 기존 Bearer만 요구하며 별도의 최근 로그인 확인은 없다. 탈취된 유효 JWT가 연동이나 탈퇴에 사용될 수 있는 정책이다. 서비스 민감도에 따라 재인증/최근 로그인 조건과 사용자 알림을 검토한다.

## 권장 후속 작업 순서

1. 정리 주기/즉시 실행/bounded 반복은 개선 완료. 정리 실패/상한 도달 streak와 처리 건수·시간 집계를 추가했다. 실제 backlog count 및 운영 경보 수집은 후속 검토.
2. 세션 만료·연동 owner FK 인덱스와 테스트 DB EXPLAIN은 완료. 운영 migration 적용 계획 필요.
3. 프록시 mapped 전체범위 설정 거부는 완료. 실제 운영 프록시 허용 목록/헤더 처리 확인 필요.
4. Google timeout/오류 분류는 완료. 인스턴스별 제공자 동시 상한과 운영 집계는 추가 완료. fleet 제한/circuit breaker와 실제 경보 적용은 후속 검토.
5. 세션/토큰 누적 지표와 갱신 남용 정책, 실제 공용IP/프록시 테스트.

점검만으로 위 변경의 사용자 정책을 확정하지 않는다. 구현 시 기능별 Task로 분리하고 [서비스 정책](service-policy.md)을 함께 갱신한다.

근거 문서: [PostgreSQL FK 인덱스](https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-FK), [proxy-addr 공식 구현](https://github.com/jshttp/proxy-addr/blob/master/index.js), [Redis rate limiting](https://redis.io/docs/latest/develop/use-cases/rate-limiter/).
