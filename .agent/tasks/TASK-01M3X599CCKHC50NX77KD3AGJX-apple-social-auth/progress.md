# Progress

## Current State

Apple 설계에 사용자 “진행해” 승인. 서버 로그인·nonce 보호·DB·HTTP·문서 구현과 전체 검증·리뷰 완료.

## Decisions

- Decision: 서버 생성 nonce를 Apple 요청에 그대로 전달한다. Reason: 검증된 토큰의 nonce를 해시해 DB와 대조한다. SDK가 자동 해시한다면 최종 요청 값을 이 계약에 맞춰야 한다.
- Decision: DB 조건부 소비를 사용한다. Reason: 다중 서버·동시 재사용을 막는다. 검증 후 소비하고 회원·세션 저장 실패 시 새 시도로 재시작한다.
- Decision: ID 토큰 검증만 수행한다. Reason: 승인된 계약이며 Apple refresh/revoke/code 교환은 범위 밖이다.
- Decision: feat/auth checkout 재사용. Reason: 사용자 지정 브랜치이며 무관한 scaffold 보존.
- Decision: 준비 문서 TDD N/A. Reason: 제품 동작 변경이 없다.

## Completed / In Progress / Remaining

공식 계약·승인·TDD 구현·전체 검증·문서·최종 리뷰 완료. 이번 범위 미완료 항목 없음. 검증된 변경만 로컬 커밋한다.

## Issues / Blocker

없음. 실제 Apple 콘솔·모바일 로그인은 미실행으로 명시한다.

## Discovered Requirements

Naver Task의 DISC-MOBILE-PROVIDERS 중 Apple 서버 인증은 이번 승인으로 정식 R에 승격했다. 모바일 SDK·네이버 버튼은 범위 밖이다.

## Failed Attempts

없음.

## Next Action

이번 Task의 다음 행동 없음. 후속 Apple 콘솔 설정·모바일 SDK와 실제 로그인은 별도 작업 승인 대상이며 push·PR·병합은 승인 범위 밖이다.

## TDD 진행

T-R1/T-R2 최소 선언 후 Unit 33개 기대 실패 RED 확인, 구현 후 33개 GREEN. 키 교체 회귀 PASS. HTTP 입력 보존과 Apple 설정 누락 2개 RED 확인(기존/입력 거부 회귀 72 PASS). Migration은 enum 추가·독립 테이블/인덱스 생성만 포함하며 기존 데이터 삭제·변경이 없다.

T-R1/T-R3 DB 최소 선언 후 4개 RED, schema 준비 후 Apple 회원 저장은 회귀 PASS로 구분했다. 구현 후 DB 5개 GREEN. Apple E2E 미등록 상태 10개 RED·입력 거부 3개 회귀 PASS, 연결 후 13개 GREEN. 키 조회 중 만료 1개 RED→GREEN. 관련 Unit 76 PASS. 실제 DI integration 및 전체 회귀 검증이 남았다.

## 전체 검증

API Unit 230(23파일), E2E 72(8파일), Integration 23(6파일) PASS. 실제 Apple DI·nonce DB 소비·신규/기존 회원·서비스 세션 및 재사용 차단 검증 PASS. tsc·변경 TS eslint·Nest build PASS. 모바일 코드는 수정하지 않아 모바일 Suite는 범위 밖이다. 테스트 실행 버전은 Vitest 4.1.11, jose 6.2.12, Prisma 7.10.0이며 패키지/lockfile 변경 없음. 리뷰 진행 중.

## 최종 리뷰

Fresh reviewer 읽기 전용 검토에서 수정 필요 finding 없음. 제외 판단: 실제 콘솔/SDK·provider code/refresh/revoke·다른 제공자 state·만료 행 자동 삭제·무관한 scaffold는 승인 범위 밖이다. reviewer 자체 테스트는 Vite 시작 spawn EPERM으로 실행되지 않았으며, 부모의 권한 실행 전체 PASS 결과와 구분한다. 만료 행 정리 정책과 계정 상태/서비스 세션 동기화는 문서에 제한으로 명시한다.
