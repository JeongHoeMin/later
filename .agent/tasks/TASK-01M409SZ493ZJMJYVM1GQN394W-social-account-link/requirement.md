# Requirement

## R1 · 로그인 회원의 소셜 계정 연동

- AC-R1-1: POST /users/me/social-accounts는 Bearer 본인에게 서버가 검증한 Google/Kakao/Naver/Apple 계정을 연결하고 200 {id,provider,linkedAt}를 반환한다. 새 회원·세션을 발급하지 않는다.
- AC-R1-2: 연결된 제공자로 로그인하면 동일 회원 ID다. 회원당 제공자별 1개이며 같은 연결은 새 유효 proof로 반복 요청하면 200이다.
- AC-R1-3: 타 회원 소유 계정이나 본인의 동일 제공자 다른 계정은 409 SOCIAL_ACCOUNT_CONFLICT다. 기존 연결을 보존하며 DB unique·회원 행 잠금으로 동시성을 보호한다.
- AC-R1-4: 엄격한 입력 400, 인증 실패 401, 외부 장애 503, 내부 오류 500을 구분한다. subject·타 회원 정보·토큰을 응답에 노출하지 않는다.

## R2 · 회원과 목적에 묶인 연동 시도

- AC-R2-1: 인증된 POST /users/me/social-accounts/apple/start 및 /naver/start로 본인 시도를 만든다. body 없음/{}만 허용하며 201·5분 만료·no-store를 제공한다.
- AC-R2-2: Apple nonce·Naver grant를 서버에서 검증하고 시작 회원만 소비할 수 있다. 일반 로그인·연동 시도를 혼용하지 못한다. 목적·회원 불일치는 시도를 소비하지 않는다.
- AC-R2-3: Naver는 기존 callback·고정 앱 URI·시도 ID만 리다이렉트하는 계약을 유지한다. 정상 소비는 일회성이므로 재전송은 401이며 새 시작이 필요하다.
- AC-R2-4: migration은 nullable ownerUserId·FK cascade와 (userId,provider) unique를 추가한다. 기존 행 삭제·자동 계정 통합은 없다.

## Out of Scope

계정 병합·교체·해제, 외부 제공자 revoke, 모바일, 운영 배포, 제공자 프로필 수집.
