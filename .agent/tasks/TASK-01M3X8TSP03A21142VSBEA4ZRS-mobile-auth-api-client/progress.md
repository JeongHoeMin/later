# Progress

사용자 승인: Swagger를 main에 병합하고 feat/auth 최신화 후 로그인 프로세스 API들을 분리된 Task로 순차 개발하라는 요청.

Swagger PR #8(main 935b1e9) 병합 및 feat/auth fast-forward 완료. 이 Task는 HTTP 공통 클라이언트 범위다.

Decision: 서버와 같은 네 제공자 입력을 사용하고 POST/상태/응답을 검증한다. 인증 API에 bearer를 넣지 않고 제공자 토큰을 서비스 토큰으로 취급하지 않는다. 15초 abort, 오류 원문 차단, 자동 재시도 없음(회전 refresh token 재사용 시 세션 폐기 방지).

RED 14개 기대 동작 실패 → GREEN 14개 → 오류/타임아웃 회귀 5개 추가, 총19개 PASS. 타입검사에서 객체 narrowing 반환 오류를 확인해 명시적인 결과 조립으로 수정했다.

expo install vitest 설치는 기존 Prisma/scarf build-script 승인 정책으로 exit1을 반환했다. package/lock 반영 후 frozen-lockfile --ignore-scripts 설치 성공. 자동 추가된 scarf 미결정 정책은 제거해 기존 정책 보존. native 의존성 추가 없음.

전체 mobile lint에서 기존 NativeModule<{}> 타입 오류를 발견했다. Expo 선언 기본 타입을 사용하도록 한 줄 수정(타입만, 런타임 동작 없음/TDD 예외). 포맷 재검증 예정.

후속 Task: 토큰 수명주기·보안 저장, 제공자 SDK/UI. 실제 기기/제공자 설정 검증은 이 Task 범위 밖. 제공자 SDK 범위에 대한 비동기 질문은 아직 답변 없음.

리뷰 P2 응답 본문 수신 타임아웃 오분류: 200/503 본문 지연2개 RED → 수정 후21/21 GREEN. 전체 lint 및 tsc PASS. Android Metro export PASS(실제 기기/native 로그인 검증 아님).
