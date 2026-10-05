# Auth 운영 지표와 동시 처리

2026-10-05 현재 서버 구현 기준이다. [서비스 정책](service-policy.md#제공자-동시-처리-제한)과 [서비스 구성](service-architecture.md)이 기준이며 실제 운영 수집기·대시보드·경보 전송을 설정한 것은 아니다.

## 제공자 처리 상한

`AUTH_PROVIDER_MAX_CONCURRENCY`는 인스턴스별·제공자별 최대 동시 검증 수다. 미설정10, 설정1~100 정수. 로그인과 연동은 같은 gate를 공유한다. 초과 요청은 대기열 없이503으로 실패한다. Google/Kakao/Naver/Apple의 예산은 독립적이다. 슬롯은 provider authenticate가 끝날 때 반환하며 회원/세션 DB 저장은 슬롯에 포함하지 않는다.

여러 인스턴스는 각각 예산을 갖는다. fleet 전체 Redis lease/semaphore나 circuit breaker는 없다. 인스턴스를 늘리면 제공자 전체 동시 호출량도 늘 수 있어 배포 연결 제한과 함께 조정한다. HTTP request rate limit의 IP/회원 예산과 별개다. Naver 완료는 grant 소비가 앞서므로503이면 새 시도가 필요하다.

## 집계 로그

`AuthOperationsMetrics`는5분마다 `auth.operations.summary` 이벤트 하나로 다음 집계를 출력한다. 데이터가 없고 진행 중 검증도 없으면 출력하지 않는다. module 종료 시 timer를 중단하고 application shutdown에서 마지막 집계를 기록한다. 정리 작업 drain 이후의 결과도 포함한다. 수집기 오류/프로세스 강제 종료 때 최종 전달이나 복구는 보장하지 않는다.

요청마다 지표 로그·DB/Redis 조회·backlog COUNT를 추가하지 않는다. 제공자 이름은 고정4개이고 회원/IP/토큰/자격 증명/오류 원문을 저장하지 않는다. 구조체의 슬롯 수는 일정하다. 메모리 지표이며 재시작 시 집계/연속 상태가 초기화된다. 기존 요청 로그와 Observe 설정은 별도로 유지한다.

| 영역       | 필드                                                                  | 의미                                                                                           |
| ---------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| provider별 | success / invalid / unavailable / error / busy                        | 검증 성공 / 인증 실패 / 외부 장애 / 예상 밖 오류 / gate 초과 건수                              |
| provider별 | active / peak                                                         | 현재 진행 중 수 / 집계 창 내 최대 동시 처리 수                                                 |
| provider별 | durationMsTotal / durationMsMax                                       | 완료한 검증의 총/최대 처리시간. 초과 거부는 시간 집계 제외                                     |
| cleanup    | runs / failures / limitReachedRuns                                    | 정리 실행 수 / 실행 실패 수 / 반복 상한 도달 실행 수                                           |
| cleanup    | consecutiveFailures / consecutiveLimits                               | 연속 실패 / 연속 상한 도달. 성공 시 실패 streak 초기화, 실패·상한 미도달 시 상한 streak 초기화 |
| cleanup    | appleAttempts / naverAttempts / sessions / rateLimitBuckets / batches | 성공한 전체 실행의 삭제 건수와 배치 수                                                         |
| cleanup    | durationMsTotal / durationMsMax                                       | 정리 실행의 총/최대 처리시간                                                                   |

provider 지표는 제공자 검증 결과이며 로그인 API 전체 성공률과 다르다. 본문/Guard 실패와 이후 DB 저장 실패는 provider 지표에 포함하지 않는다. API 요청 로그와 같이 해석한다. 평균 지연은 완료 건수(success+invalid+unavailable+error)가 있을 때 durationMsTotal/완료 건수로 계산한다. active와 streak는 집계 창이 바뀌어도 유지하고 나머지 수치만 초기화한다. 로그 출력을 던지는 오류는 인증·정리에 전파하지 않고 다음 집계에서 재시도한다.

정리의 일부 배치를 커밋한 뒤 이후 배치가 실패하면 실제 삭제는 보존되지만 실패한 실행의 삭제 건수는 이 지표에 포함되지 않는다. `limitReached`는 추가 행 존재를 확정하지 않는다. 이 집계는 실제 만료 backlog 수·가장 오래된 만료 시각을 제공하지 않는다.

## 운영 확인과 권장 경보

수집기에 이벤트를 연결한 뒤 인스턴스 식별자는 배포 메타데이터로 붙인다. 요청 식별자·회원/IP 등을 provider 라벨에 추가하지 않는다. 메모리 상태를 합산할 때 active는 인스턴스별 최신 값으로 해석하며 창별 결과 건수는 해당 창만 합산한다.

초기 경보 후보는 정리 연속 실패3회, 연속 상한 도달3회, 지속되는 busy 비율 증가, unavailable/지연 급증이다. 실제 값은 트래픽과 DB/제공자 상태를 관측해 조정한다. 구현된 자동 알림 기준이 아니다. 전체 요청량·Redis 가용성·DB 연결 수·실제 backlog 및 자체 API readiness는 별도 운영 관측 대상이다.

근거: [gate](../apps/api/src/auth/infrastructure/operations/provider-concurrency-gate.ts), [집계](../apps/api/src/auth/infrastructure/operations/auth-operations.metrics.ts), [정리 scheduler](../apps/api/src/auth/infrastructure/cleanup/auth-cleanup.scheduler.ts).
