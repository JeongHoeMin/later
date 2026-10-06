# Requirement

## Background / Goal

부모 Task에서 제공자 SDK로 토큰을 받는 데까지 구현했다. 서버 API(feat/auth, 2026-10-02 계약 문서, 실행 서버 `/docs-json`)가 준비되어 제공자 결과를 Later 서비스 로그인으로 교환한다.
네이버는 서버가 인가 URL·Callback·state 검증을 맡는 브리지 흐름으로 바뀌어, 앱은 Client Secret과 네이티브 SDK를 쓰지 않는다.

## R1 - Later API 클라이언트

### Acceptance Criteria

- AC-R1-1: `EXPO_PUBLIC_API_BASE_URL` 기준으로 JSON 요청을 보내고 성공 본문을 반환한다. 204는 본문 없이 성공한다.
- AC-R1-2: 오류 응답 `{ error: { code, message } }`를 `ApiError(status, code)`로 변환한다. 네트워크 실패는 status 0으로 구분한다.
- AC-R1-3: 토큰·코드·비밀값을 로그에 남기지 않는다.

## R2 - 카카오·구글 서비스 로그인

### Acceptance Criteria

- AC-R2-1: 카카오 Access Token은 `{ provider: 'kakao', credential }`, 구글 ID Token은 `{ provider: 'google', credential }`로 `POST /auth/social/login`에 보낸다. 다른 필드를 보내지 않는다.
- AC-R2-2: SDK 취소 시 API를 호출하지 않고 cancelled를 반환한다.

## R3 - Apple 서비스 로그인

### Acceptance Criteria

- AC-R3-1: `POST /auth/social/apple/start`를 먼저 호출하고 받은 nonce를 해시 없이 Apple 요청에 전달한다.
- AC-R3-2: Apple ID Token과 같은 시도의 loginAttemptId를 `POST /auth/social/login`에 보낸다.
- AC-R3-3: 취소하거나 시도 만료(expiresIn) 후 결과는 폐기하고 로그인 API를 호출하지 않는다.

## R4 - 네이버 브리지 로그인

### Acceptance Criteria

- AC-R4-1: `POST /auth/social/naver/start` 응답의 authorizationUrl을 수정하지 않고 인증 브라우저로 연다. 반환 URL은 `kr.pe.hoe.later://auth/naver`다.
- AC-R4-2: 반환 URL의 loginAttemptId가 현재 시도와 같고 만료 전일 때만 `{ provider: 'naver', loginAttemptId, attemptSecret }`로 `POST /auth/social/login`을 호출한다. (`/auth/social/naver/complete`는 서버에서 제거됨)
- AC-R4-3: 취소·다른 ID·ID 누락·만료는 최종 로그인을 호출하지 않는다. attemptSecret은 URL에 넣지 않는다.
- AC-R4-4: 앱에서 네이버 네이티브 SDK·Client Secret·URL Scheme 설정을 제거한다.

## R5 - 서비스 토큰 저장과 로그아웃

### Acceptance Criteria

- AC-R5-1: 로그인 성공 시 Access/Refresh Token을 expo-secure-store에 저장하고 회원 ID를 화면에 전달한다.
- AC-R5-2: 로그아웃 시 저장된 Refresh Token으로 `POST /auth/logout`을 호출하고, API 결과와 관계없이 로컬 토큰을 삭제한다.

## R6 - 화면 오류 처리

### Acceptance Criteria

- AC-R6-1: 401은 "다시 로그인" 안내, 503·500·네트워크 오류는 "잠시 후 다시 시도" 안내를 표시한다. 진행 중 중복 시도는 막는다.
- AC-R6-2: 로그인 후 화면에서 로그아웃하면 로그인 화면으로 돌아간다.

## Out of Scope

- 앱 복원(`/auth/token/refresh` 후 `GET /auth/me`)과 자동 토큰 갱신: 다음 Task.
- Android Apple 로그인, Google nonce, 서버 측 변경.
- 운영 HTTPS API 주소와 release 빌드 설정.
