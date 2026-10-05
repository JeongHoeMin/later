# Later 서비스 정책

이 문서는 현재 서버 코드에 구현된 서비스 정책의 기준 문서다. 마지막 확인일은 2026-10-05이며 `feat/auth`의 구현을 기준으로 한다. 저장소 구현과 운영 서버 적용 상태는 다르다. 기획 초안의 미구현 기능을 확정된 정책으로 취급하지 않는다. 향후 서비스 정책이 포함된 구현은 이 파일의 해당 항목을 함께 갱신한다.

## 회원 식별과 소셜 로그인

- Google, Kakao, Naver, Apple 소셜 인증을 지원한다. 자체 비밀번호 가입·로그인은 없다.
- 검증한 제공자와 제공자 회원 식별값의 조합으로 회원을 찾는다. 첫 로그인은 회원과 소셜 연결을 생성하고, 이후 같은 소셜 계정은 같은 회원으로 로그인한다.
- 이메일이 같아도 회원을 자동 병합하지 않는다. 사용자가 보낸 회원 식별값을 그대로 신뢰하지 않고 서버가 제공자 인증 정보를 검증한다.
- Google은 허용 Client ID의 ID Token, Kakao는 설정된 앱 ID에 속한 Access Token, Apple은 허용 audience의 ID Token과 서버 시도/nonce를 검증한다. Naver는 서버가 생성한 인가 URL과 callback을 거쳐 서버에서 코드를 교환한다.
- Google 인증서 HTTP 조회는5초 timeout과 자동 재시도0회를 적용한다. SDK의 인증서 cache는 유지한다. 인증서 통신 실패·HTTP 오류·잘못된 인증서 응답은 로그인/연동에서 `503 / INTERNAL_SERVER_ERROR`, 잘못된 JWT·서명·claims·subject는 `401 / SOCIAL_AUTHENTICATION_FAILED`로 구분한다. 인증서 응답은 검증 후 cache에 반영하며 장애 시 회원·세션·연동을 저장하지 않는다. 외부 오류 원문은 응답하지 않는다. API 인스턴스 내 제공자 동시성 상한은 아래 정책을 따른다. fleet 전체 제한/circuit breaker는 아직 없다.
- 소셜 로그인 성공 응답은 회원 ID와 Later Access/Refresh Token이다. 제공자 토큰은 서비스 로그인 응답으로 반환하지 않으며, 회원·세션 저장소에 제공자 토큰 원문을 보관하지 않는다.

근거: [소셜 로그인 유스케이스](../apps/api/src/auth/application/social-login.use-case.ts), [회원 저장소](../apps/api/src/users/infrastructure/persistence/prisma-social-user.repository.ts), [앱 연동 절차](social-login-process.md), [Google 통신 경계](../apps/api/src/auth/infrastructure/google/google-oauth-client.ts).

## 제공자 동시 처리 제한

로그인과 소셜 연동의 제공자 검증은 API 인스턴스별·제공자별 최대10개를 공유한다. `AUTH_PROVIDER_MAX_CONCURRENCY`로1~100 정수를 지정할 수 있고 미설정은10이다. 잘못된 설정은 서버 시작을 거부한다. 다른 제공자의 예산은 독립적이다. 큐에서 기다리지 않고 초과 시 제공자 검증/회원·세션·연동 저장 전에 `503 / INTERNAL_SERVER_ERROR`로 반환한다. 실패·성공 모두 슬롯을 반환한다. 요청 단위 IP/회원 제한은 별도로 먼저 적용된다. 동시 제한 때문에 이미 소비한 IP 예산은 복원하지 않는다.

제공자 호출만 슬롯에 포함하고 이후 회원/세션 DB 저장은 포함하지 않는다. 여러 서버/worker는 각자 예산을 가지며 fleet 전체 Redis 제한은 아니다. Apple 입장 거부는 provider 내부 시도 소비 전에 발생한다. Naver 완료는 기존 grant를 먼저 소비하므로 이후 동시 제한/외부 장애503이면 새 시도로 시작해야 한다. 초과·외부 장애를 구분하는 별도 응답 코드/Retry-After는 없으며 앱은 연속 즉시 재시도를 피한다.

근거: [제공자 gate](../apps/api/src/auth/infrastructure/operations/provider-concurrency-gate.ts), [공유 DI](../apps/api/src/auth/auth.module.ts). 운영 집계의 범위는 [운영 지표](auth-operations.md)를 따른다.

## 로그인·연동 시도

- Apple과 Naver의 서버 시도는 시작 후 5분 동안만 유효하며 일회용이다. 만료 시각과 같아도 만료로 처리한다.
- Apple은 서버가 반환한 nonce를 Apple 인증 요청에 그대로 전달하고 완료 시 시도 ID와 ID Token을 제출한다.
- Naver는 앱이 시도 ID와 비밀값을 보관한다. callback에서는 state·만료·일회 사용을 검증하고, 완료에서는 시도 ID/비밀값을 확인한다. callback의 앱 반환 URL에는 시도 ID만 포함한다. 시도에 보관하는 인가 코드는 암호화하며 완료 소비 시 지운다.
- 연동용 시도는 시작한 회원에게 묶인다. 일반 로그인용 시도와 혼용하거나 다른 회원이 완료할 수 없다.
- 시도가 소비된 뒤 외부 인증·회원/세션 저장이 실패하거나 응답을 잃으면 새 시도로 시작한다. 제공자 인증을 취소한 경우에도 새 시도로 시작한다.

근거: [Apple 시작](../apps/api/src/auth/application/start-apple-login.use-case.ts), [Naver 흐름](../apps/api/src/auth/application/naver-login-flow.ts), [소셜 연결](../apps/api/src/auth/application/link-social-account.use-case.ts).

## 서비스 토큰과 세션

| 항목 | 현재 정책 |
| --- | --- |
| Access Token | Later JWT, 유효기간 15분, Bearer 인증 |
| 서비스 세션 | 로그인 시 생성, 유효기간 30일 |
| Refresh Token | DB에 해시만 저장, 갱신 성공마다 새 토큰으로 교체 |
| 세션 연장 | 갱신해도 최초 세션 만료일을 연장하지 않음 |
| 토큰 재사용 | 사용 완료 Refresh Token 재사용 시 해당 세션 폐기 |
| 여러 기기 | 별도 로그인으로 생성된 다른 세션은 유지 |

`POST /auth/token/refresh`는 새 Access/Refresh Token을 반환한다. 클라이언트는 갱신을 직렬화하고 성공한 새 토큰으로 교체한다. 동일 토큰을 동시에 갱신하면 먼저 성공한 후속 토큰도 재사용 탐지로 사용할 수 없게 될 수 있다. 만료·폐기·알 수 없는 Refresh Token은 `401 / INVALID_REFRESH_TOKEN`이다.

Bearer 보호 API는 JWT 검증에 더해 회원이 DB에 존재하는지 확인한다. 세션 폐기 여부를 Access Token에서 조회하지 않으므로 일반 로그아웃 또는 Refresh Token 재사용 탐지 후 기존 Access Token은 최대 남은 15분 동안 유효하다. 탈퇴한 회원의 Access Token은 회원 존재 확인으로 이후 요청에서 거부한다.

근거: [세션 발급](../apps/api/src/auth/application/issue-session.use-case.ts), [세션 저장소](../apps/api/src/auth/infrastructure/persistence/prisma-auth-session.repository.ts), [JWT](../apps/api/src/auth/infrastructure/tokens/jwt-access-token.ts), [인증 Guard](../apps/api/src/auth/presentation/http/access-token.guard.ts).

## 로그아웃

`POST /auth/logout`에 Later Refresh Token을 제출하면 그 토큰이 속한 세션을 폐기한다. 사용 완료 토큰도 해당 세션의 로그아웃에 사용할 수 있다. 이미 폐기했거나 알 수 없는 토큰도 유효한 요청 형식이면 `204`이며 응답 본문은 없다. 다른 기기 세션은 유지한다. 잘못된 요청 형식은 `400`, 아래 요청 제한을 초과하면 `429`가 우선 적용된다.

로그아웃은 회원 삭제 또는 제공자 계정의 연결 해제를 수행하지 않는다. 클라이언트는 자신의 저장된 서비스 토큰을 제거한다.

근거: [로그아웃 유스케이스](../apps/api/src/auth/application/logout-session.use-case.ts), [세션 HTTP](../apps/api/src/auth/presentation/http/session.controller.ts).

## 회원 탈퇴와 재가입

- `DELETE /users/me`는 유효한 서비스 Bearer로 본인 탈퇴를 요청한다. 별도 비밀번호·재인증 증거를 요구하는 정책은 현재 없다.
- 회원, 모든 소셜 연결, 모든 기기의 세션/Refresh Token, 회원에게 묶인 Apple/Naver 연동 시도를 즉시 원자적으로 삭제하고 `204`를 반환한다.
- 탈퇴 유예기간·복구 기능은 없다. 이후 인증 요청에서 기존 회원의 JWT도 거부한다. 이미 실행 중인 요청을 취소하는 기능은 없다.
- 소셜 제공자에 대한 토큰 revoke·앱 연결 해제나 제공자 계정 삭제는 수행하지 않는다.
- 동일 소셜 계정으로 다시 로그인하면 새 회원 ID로 가입한다.
- 현재 서버 데이터 모델에는 콘텐츠·결제·구독이 없다. 해당 데이터의 탈퇴 처리나 법적 보존기간은 아직 구현된 정책이 아니며 도입 시 별도로 정하고 이 문서를 갱신한다.

근거: [회원 HTTP](../apps/api/src/users/presentation/http/user-account.controller.ts), [회원 계정 저장소](../apps/api/src/users/infrastructure/persistence/prisma-user-account.repository.ts), [DB 스키마](../apps/api/prisma/schema.prisma).

## 본인 소셜 계정 조회와 추가 연동

`GET /users/me/social-accounts`는 본인의 연결 목록을 생성 시각/ID 순으로 반환한다. 각 항목에는 연결 ID, 제공자, 연결 시각만 포함한다. 제공자 회원 식별값·이메일·토큰은 반환하지 않으며 응답은 `no-store`다.

`POST /users/me/social-accounts`는 로그인한 상태에서 새 제공자 인증을 검증해 현재 회원에게 연결한다. 네이버로 로그인한 회원이 Google을 연결하면 이후 두 제공자로 같은 회원에 로그인할 수 있다. 연동은 새 서비스 세션이나 토큰을 발급하지 않는다.

| 조건 | 결과 |
| --- | --- |
| 현재 회원에게 없는 제공자의 미연결 소셜 계정 | 연결 후 `200` |
| 이미 본인에게 연결된 같은 소셜 계정 | 새 유효 인증 증거를 검증한 뒤 기존 연결을 `200`으로 반환 |
| 다른 회원에게 연결된 소셜 계정 | `409 / SOCIAL_ACCOUNT_CONFLICT` |
| 본인이 같은 제공자의 다른 소셜 계정을 이미 연결 | `409 / SOCIAL_ACCOUNT_CONFLICT` |
| 미인증·탈퇴 회원 | `401` |

회원당 제공자별 하나만 연결할 수 있어 현재 최대 네 제공자를 연결한다. 계정 병합·연결 교체·연동 해제는 지원하지 않는다. Apple/Naver는 본인 Bearer로 `/users/me/social-accounts/apple/start` 또는 `/users/me/social-accounts/naver/start`를 먼저 호출한다. Naver callback 주소는 일반 로그인과 공유한다. 로그인 회원이 바뀌면 새 연동을 시작한다.

근거: [연동 HTTP](../apps/api/src/auth/presentation/http/social-account-link.controller.ts), [회원 계정 저장소](../apps/api/src/users/infrastructure/persistence/prisma-user-account.repository.ts).

## 인증 API 요청 제한

첫 요청부터 60초인 고정 창을 사용한다. 아래 횟수까지 허용하고 다음 요청부터 `429 / RATE_LIMIT_EXCEEDED`로 차단한다. 성공 여부와 관계없이 Guard에 도달한 요청은 횟수를 소비하며, 차단 요청은 창의 종료 시각을 연장하지 않는다. 새 창이 되면 다시 허용한다. `Retry-After` 헤더는 재시도까지 남은 초다.

| 공유 그룹 | 적용 경로 | 60초 제한 |
| --- | --- | --- |
| 소셜 로그인 | `POST /auth/social/login`, `POST /auth/social/apple/start`, `POST /auth/social/naver/start`, `GET /auth/social/naver/callback` | IP별 합계 20회 |
| 갱신 | `POST /auth/token/refresh` | IP별 60회 |
| 로그아웃 | `POST /auth/logout` | IP별 60회, 갱신과 별도 |
| 소셜 연동 | `POST /users/me/social-accounts`, `POST /users/me/social-accounts/apple/start`, `POST /users/me/social-accounts/naver/start` | IP별 합계 10회 및 인증 회원별 합계 10회, 둘 다 충족 |

IP 제한은 인증·본문 검증·외부 인증·시도 소비 전에 검사한다. 연동의 회원 제한은 Bearer 인증 후 검사한다. 인증 실패도 IP 횟수는 소비한다. 같은 회원은 IP를 바꿔도 회원 제한을 적용받으며, 같은 IP의 여러 회원은 IP 예산을 공유한다. `/auth/me`, 연결 목록 조회, 회원 탈퇴, 기타 경로에는 이 제한을 적용하지 않는다.

카운터는 Redis에 저장해 서버 인스턴스 간 공유하고 서버 시계 대신 Redis TTL로 창의 종료를 판단한다. Lua로 조회·허용 판정·증가를 원자 처리하며 이미 한도를 채운 키는 추가 증가 없이 거부한다. TTL은 최초60초이며 만료 시 자동 삭제된다. Redis 재시작으로 데이터가 사라지면 진행 중인 제한 창은 초기화된다. 저장소 장애 시 제한을 우회하지 않고 내부 오류로 요청을 실패시킨다. 초기 Redis 연결 실패는 API 시작을 거부하며 런타임 명령은1초 deadline 후 실패한다. DB fallback은 없다. 메모리 부족 시 임의 키 eviction으로 예산을 초기화하지 않고 실패한다. timeout 이전 이미 전송된 명령은 카운터를 소비했을 수 있다. 저장하는 키는 그룹·IP 또는 그룹·회원 ID를 SHA-256으로 해시한 값이며 토큰·원본 IP·회원 ID는 카운터에 저장하지 않는다. IP 해시는 익명화 보장을 뜻하지 않는다. 현재 제한값은 초기 기본값이며 실제 트래픽과 공용 네트워크의 영향을 관찰해 조정한다.

기본적으로 `X-Forwarded-For` 등 전달 IP 헤더를 신뢰하지 않는다. 프록시 배포에서는 서버가 관리하는 실제 프록시 IP/CIDR만 `TRUSTED_PROXY_CIDRS`에 지정하고 프록시가 클라이언트 전달 헤더를 안전하게 처리하도록 구성한다. 빈 값은 신뢰 없음, 임의 헤더를 신뢰하는 `true`·홉 수·전체 대역(`/0`) 설정은 허용하지 않는다. IPv6 표기여도 전체 mapped IPv4 `/96`을 포함하는 CIDR(예: `::ffff:0:0/96`, `::/80`)은 거부한다. IPv4가 포함된 IPv6의 host bits·압축·대소문자 표기 차이로 이 검증을 우회할 수 없다. 전체 IPv4를 포함하지 않는 명시 범위는 기존 방식으로 허용한다. 신뢰 설정이 없으면 프록시 IP로 예산을 공유할 수 있다.

근거: [제한 정책과 OpenAPI](../apps/api/src/auth/presentation/http/auth-rate-limit.ts), [제한 Guard](../apps/api/src/auth/presentation/http/auth-rate-limit.guard.ts), [공유 카운터](../apps/api/src/auth/infrastructure/rate-limit/redis-auth-rate-limit.repository.ts), [Redis 실행·운영](redis.md), [프록시 설정](../apps/api/src/auth/infrastructure/rate-limit/client-ip.ts).

## 인증 데이터 정리와 응답 보안

- API 시작 시 즉시 실행하고 이후5분마다 만료된 Apple/Naver 로그인·연동 시도와 서비스 세션을 정리한다. 배치당 테이블별 최대500개, 실행당 최대10배치를 같은 기준 시각으로 처리한다. 모든 테이블의 삭제 건수가500미만이면 중단한다. 배치 사이에서 단조 시각 기준10초 실행 예산을 확인하며 이미 진행 중인 DB 작업을 강제로 취소하지 않아 전체 소요시간의 엄격한10초 상한은 아니다. 이전 PostgreSQL 카운터도 같은 배치로 정리하고 새 Redis 카운터는60초 TTL로 자동 삭제한다. 만료 세션의 Refresh Token은 함께 삭제한다.
- 만료 전 세션은 폐기 여부와 관계없이 보존한다. 사용 완료 Refresh Token도 세션 만료까지 유지해 재사용 탐지를 보호한다. 사용자·소셜 연결은 정리 대상이 아니다.
- 한 프로세스의 중복 작업을 방지하고 여러 서버의 DB 잠금을 건너뛴다. 배치별로 트랜잭션을 커밋하므로 이후 배치 실패 시 이전 성공 배치는 유지하고 다음 주기에 재시도한다. 성공 로그는 이벤트·삭제 건수·배치 수·상한 도달 여부, 실패 로그는 이벤트만 기록한다. 상한 도달은 추가 대상 존재의 확정 판정이 아니다.
- 만료는 즉시 사용 거부 기준이며 물리 삭제 시각과 다르다. 서버 중지·DB 오류·잠긴 행·실행 예산 또는 처리량을 넘는 만료 유입에 따라 삭제가 지연될 수 있다. 확정된 삭제 완료 시간 보장은 없다.
- 오류 응답은 `{ error: { code, message, details? } }`이며 내부 오류 원문을 노출하지 않는다. 인증 본문·Authorization·쿠키 및 callback의 비밀 query를 요청 로그에 남기지 않는다. 프록시 로그도 별도 설정이 필요하다.

근거: [정리 동작](../apps/api/src/auth/infrastructure/cleanup/README.md), [오류 계약](../apps/api/src/common/http/README.md).

## 적용 상태와 문서 관리

이 문서는 구현 정책이며 법적 이용약관·개인정보 처리방침을 대신하지 않는다. 실제 소셜 계정·앱 딥링크·운영 프록시 흐름을 자동 테스트 결과만으로 검증 완료라 주장하지 않는다.

이전 요청 제한 테이블 migration은 격리 `later_test`에서 검증했다. Redis 전환은 새 migration 없이 DI 저장소를 변경하며 기존 테이블과 migration 이력을 보존한다. 운영 적용 전 공유 Redis와 REDIS_URL, 새 서버 배포, 기존 미적용 migration의 `prisma migrate deploy`, 실제 프록시 허용 목록 설정이 필요하다. 정리/연동 조회 인덱스 추가 migration도 격리 later_test에서 검증했다. 일반 CREATE INDEX는 생성 중 쓰기를 막을 수 있으므로 운영 데이터량과 작업 시간을 검토해 적용한다. 이번 작업에서 개발·운영 DB, 모바일, 배포는 변경하지 않았다.

정책을 바꾸는 구현은 이 파일에서 수치·조건·예외·오류·미지원 범위를 수정하고 관련 Task의 progress/verification에 갱신 항목을 기록한다. 구현과 문서를 같은 변경 세트로 검증한다. 상세 입력 계약은 [HTTP 계약](../apps/api/src/auth/presentation/http/README.md)과 실행 서버의 [OpenAPI](openapi.md)를 따른다.
