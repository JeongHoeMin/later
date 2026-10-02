# Progress

사용자 승인 근거: Swagger/main 반영 후 인증 API 연동·모바일 참고 문서, Task분리 순차 진행 요청.
앞선 HTTP ac07da3, 세션8cb349b 완료. 이 Task는 문서+기존 기능 통합 회귀 보호망이다. 새 product Behavior를 추가하지 않아 TDD RED 예외: 기존 실제 클라이언트/세션을 조립하는 테스트는 처음부터 GREEN, 사후 RED로 표현하지 않는다.

auth-integration.spec.ts에서4-provider 입력, Apple 시작nonce, 저장(서비스 refresh만), 다음 인스턴스 복원/서버 회전, logout204를 검증한다. SDK 인증/실제 Nest 서버/native 저장을 대체한 범위임을 문서에 명시한다.

mobile-auth-integration.md와 .env.example 추가, 기존 social-login-process.md의 구현 현황을 갱신. 공개 env/서버 secret 구분, 한 인스턴스 공유, retry/reuse, storage 실패, actual App.tsx 미연결 명시.

모바일 SDK/UI 범위 비동기 질문 답변 없음. 현재 서버 인증 API는 기존4-provider 계약으로 이미 구현되어 있으며 이번 Task에서 서버 계약을 임의로 확장하지 않았다.

후속 리뷰 P2: 갱신 후 저장이 token 수명만큼 지연되면 이미 만료된 access 반환. 재현1개 RED 후 만료 재검사 추가, 전체45 GREEN. R3로 기록. 문서/통합 회귀에는 RED 예외를 적용하지만 이 동작 수정에는 실제 RED를 확인했다.
