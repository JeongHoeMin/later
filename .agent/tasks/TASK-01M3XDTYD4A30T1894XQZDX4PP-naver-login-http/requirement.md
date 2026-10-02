# Requirement
## R1 - 서버 네이버 HTTP 흐름
- AC-R1-1: 시작 POST는 시도 ID·비밀값·인가 URL·300초를 201로 반환한다.
- AC-R1-2: 콜백 GET은 서버 state 검증 후 고정 앱 URL에 시도 ID만 포함해 303을 반환한다.
- AC-R1-3: 완료 POST는 ID와 비밀값으로 일회 로그인·서비스 세션 발급. 대기·불일치·만료·재사용·취소 401.
- AC-R1-4: 입력 오류 400, 설정·외부 장애 503, 내부 정보 비노출, no-store와 callback no-referrer.
## R2 - 공개 계약
- AC-R2-1: 기존 네이버 code/state 직접 제출을 400으로 차단. Google/Kakao/Apple 보존.
- AC-R2-2: Swagger에 세 신규 경로와 응답·입력·오류 노출, 기존 oneOf는 세 제공자만 포함.
## Out of Scope
모바일 코드·콘솔 수정·배포. 상세 문서는 후속 독립 Task.
