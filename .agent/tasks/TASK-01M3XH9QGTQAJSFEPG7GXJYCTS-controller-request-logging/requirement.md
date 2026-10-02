# Requirement
## R1 - 모든 컨트롤러 전역 로깅
- AC-R1-1: 전역 인터셉터로 요청 진입과 최종 성공/실패를 기록한다. 요청 ID, HTTP method, Controller/handler, 최종 상태와 처리 시간을 포함한다.
- AC-R1-2: 일반 GET/POST, 204, 직접 응답, 입력 오류와 4xx/5xx 예외에서 응답 계약을 보존하고 종료 로그는 한 번만 남긴다.
- AC-R1-3: 요청/응답 본문, 헤더, 실제 URL/query/params, exception 원문·stack을 기록하지 않는다. 기존 필터 원문 로그도 안전하게 대체한다.
## Out of Scope
모바일/auth 기능 변경, 외부 수집 서비스 설정, 배포. Guards/middleware에서 차단된 요청과 라우트404는 인터셉터 진입 전이므로 컨트롤러 진입 로그 대상이 아니다.
