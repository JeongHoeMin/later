# Redis 실행과 인증 요청 제한

현재 Redis는 인증 요청 제한 전용이다. 회원·소셜 연결·로그인 시도·세션·Refresh Token은 PostgreSQL에 둔다. 상세 사용자 정책은 [서비스 정책](service-policy.md#인증-api-요청-제한)을 따른다.

## 개발 실행

루트에서 Docker 엔진을 실행한 뒤 다음 명령을 사용한다.

```sh
docker compose up -d redis
```

Compose 플러그인이 없는 환경은 `docker-compose -f compose.yaml up -d redis`를 사용할 수 있다. 기본 포트는 localhost 6379다. 기존 Redis와 충돌하면 `LATER_REDIS_PORT=6380 docker compose up -d redis`로 변경하고 API의 REDIS_URL도 같은 포트로 맞춘다. Windows에서는 환경변수 설정 문법을 사용 중인 셸에 맞춘다.

`apps/api/.env`에 `REDIS_URL=redis://127.0.0.1:6379/0`을 설정한다. 예시는 로컬 전용이며 실제 인증 정보는 커밋하지 않는다. 종료는 `docker compose stop redis`다. 이 구성은 Redis 8 이미지, healthcheck, 64MB maxmemory/noeviction, 컨테이너128MB 한도, RDB/AOF 비활성화를 사용한다. 메모리가 부족하면 키를 임의로 버려 제한을 우회시키지 않고 요청을 실패시킨다. 영속 저장소가 없어 재시작하면 진행 중인 제한 창이 초기화된다.

Docker 없이 macOS/Linux에서 소스로 실행하려면 C 빌드 도구가 필요하다. 아래는 설치 경로를 변경하지 않는 임시 실행 예시다. 종료는 실행 터미널에서 Ctrl+C다.

```sh
mkdir -p /tmp/later-redis-binaries
cd /tmp/later-redis-binaries
curl -fLO https://download.redis.io/releases/redis-8.2.1.tar.gz
tar -xzf redis-8.2.1.tar.gz
cd redis-8.2.1
make -j2 BUILD_TLS=no MALLOC=libc
src/redis-server --bind 127.0.0.1 --port 6380 --save "" --appendonly no --maxmemory 64mb --maxmemory-policy noeviction
```

이 경우 로컬 API의 REDIS_URL 포트도6380으로 설정한다. 테스트에는 논리 DB15를 사용한다. 명령 지연 테스트는 테스트 전용 TCP 프록시로 해당 연결만 지연시켜 다른 연결에 영향을 주지 않는다.

## 운영 설정

API 인스턴스는 같은 환경의 Redis와 키 이름공간을 공유해야 한다. 다른 환경과 논리 DB/인스턴스를 분리한다. 운영에서는 private network, ACL/비밀번호, TLS `rediss://`, 접근 제어와 용량/장애 모니터링을 설정한다. 로컬 Compose는 운영 배포 설정이 아니다. 다른 캐시/큐를 이 Redis에 바로 혼합하지 않는다. 용량과 eviction·영속화 정책을 별도로 검토한 후 추가한다.

Redis URL은 필수이며 초기 연결은 최대5초까지 기다리고 실패하면 API 시작을 거부한다. 연결 시도 timeout2초, 명령 deadline1초, 대기 명령 최대1000개, offline queue 비활성화다. 장애 로그는 이벤트만 기록한다. 런타임 실패는 인증 처리 전에500/INTERNAL_SERVER_ERROR로 응답하고 PostgreSQL이나 인스턴스 메모리로 우회하지 않는다. 네트워크 연결 손실은 재연결하며 명령 deadline을 넘은 연결도 종료 후 재연결한다. 서버에서 이미 실행된 명령은 timeout 응답 뒤에도 카운터를 소비했을 수 있다. 요청 재시도는 횟수를 추가 소비하므로 연속 재시도를 피한다.

Redis도 과도한 요청 자체를 제거하지 않는다. 초과 요청마다 Lua 조회가 발생하므로 프록시/게이트웨이에서 별도의 전체 트래픽·동시 연결 제한이 필요하다. Redis 도입은 PostgreSQL 쓰기·행 잠금·만료 카운터 backlog를 제거하지만 전체 비용 감소를 실측한 결과는 아니다. Redis 인스턴스 비용이 추가된다.

## 테스트

`apps/api/.env.test`의 REDIS_URL은 `redis://127.0.0.1:<격리포트>/15`로 지정한다. Redis 통합 테스트는 localhost 논리 DB15만 허용하고 랜덤한 테스트 소유 키만 삭제한다. FLUSHDB/FLUSHALL을 사용하지 않는다. PostgreSQL DB는 기존 later_test를 사용한다.

```sh
cd apps/api
pnpm test:integration
```

HTTP E2E는 저장소 경계를 대체하고 실제 Guard·정책·Nest 경로를 사용한다. Redis integration은 실제 서버에서 동시성, 거부 시 추가 증가 없음, TTL 자동 삭제, Retry-After, 종료, 명령 지연/복구를 검증한다.

이번 검증 환경에는 Docker 데몬이 꺼져 있어 공식 Redis8.2.1 소스를 `/tmp/later-redis-binaries`에서 빌드해 localhost 전용 임시 서버로 실행했다. Compose 설정은 `docker-compose config --quiet`로 검증했다. 컨테이너 기동이나 운영 Redis 적용을 완료한 것은 아니다. 검증 뒤 임시 서버와 직접 만든 .env.test는 정리한다.

참고: [Redis 공식 요청 제한 예제](https://redis.io/docs/latest/develop/use-cases/rate-limiter/nodejs/), [공식 Node 클라이언트 운영 안내](https://redis.io/docs/latest/develop/clients/nodejs/produsage/).
