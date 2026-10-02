# Requirement

## Goal

컨트롤러 변경에 따라 Swagger 문서를 런타임 자동 생성하고 모바일 개발자가 GET으로 읽을 수 있게 한다. 사용자 전체 작업 순서와 PR/main 병합 승인에 포함된 첫 번째 별도 Task다.

## R1 - 자동 문서 조회

- AC-R1-1: GET /docs-json은 현재 등록된 컨트롤러 경로의 OpenAPI JSON을 인증 없이 반환한다.
- AC-R1-2: GET /docs는 동일한 문서의 Swagger UI를 제공한다. main bootstrap과 테스트에서 같은 설정 함수를 사용한다.
- AC-R1-3: API 버전·설명·Bearer 스키마를 명시하고 사용 예시를 문서화한다. 환경 비밀값을 스펙에 포함하지 않는다.

## Out of Scope

상세 로그인 schema·response 계약은 다음 별도 Task. 모바일 코드·새 인증 방식·배포는 제외한다.
