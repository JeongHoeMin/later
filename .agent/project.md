# 프로젝트 컨벤션과 참고 문서

## 저장소

pnpm workspace: `apps/api`는 NestJS/TypeScript API, `apps/mobile`은 Expo/React Native 앱, `apps/shared`는 공유 코드다.
버전은 각 package.json과 pnpm-lock.yaml에서 확인한다. 루트에서 `pnpm install --frozen-lockfile`로 설치하며 패키지 관리자를 섞지 않는다.
모바일 변경은 [모바일 지침](../apps/mobile/AGENTS.md)을 추가로 읽는다. Expo 패키지는 해당 SDK에 맞는 `expo install`을 사용한다.

## 서비스 정책

[docs/service-policy.md](../docs/service-policy.md)는 현재 구현된 서비스 정책의 단일 기준 문서다. 서비스 정책이 포함된 기능 구현·수정 시 반드시 관련 항목을 읽고 **이 파일을 함께 갱신**한다. 새 도메인 정책도 같은 파일에 항목을 추가한다. 수치·적용 조건·예외·미지원·운영 적용 상태를 실제 코드와 대조하고 Task 검증에 남긴다. 완료 기준과 자세한 절차는 [공통 Workflow](AGENTS.md#서비스-정책-문서-갱신)를 따른다.

## API 설계

- 목표: 구글·카카오·네이버·애플 소셜 계정으로 간편 회원가입과 로그인. 자체 비밀번호 회원가입은 없다. 현재 구현 상태는 해당 브랜치의 Task 문서에서 확인한다. 목표를 구현 완료로 간주하지 않는다.
- 도메인별 `users`, `auth`를 나누고 `domain`, `application`, `infrastructure`, `presentation/http` 경계를 사용한다.
- domain/application은 Nest·Prisma·HTTP에 의존하지 않는다. 유스케이스는 필요한 포트에 의존하고 infrastructure가 구현한다. Nest Module에서 DI를 조립한다.
- SOLID와 객체지향을 적용하되 미래 기능을 위한 상속·인터페이스를 만들지 않는다. 한 클래스의 책임과 필요한 의존성을 작게 유지하고 composition을 우선한다.
- User, SocialAccountKey, repository 계약은 해당 책임의 파일에 둔다. Prisma 생성 타입이 application 계약으로 새지 않게 한다.
- 회원은 검증된 `(provider, subject)`로 식별한다. 이메일만 같다고 계정을 자동 통합하지 않는다. 클라이언트가 보내는 subject를 신뢰하지 않는다.
- 소셜 인증은 제공자의 토큰을 검증한 후 내부 회원을 조회·생성한다. DB 조회로 외부 인증을 대체하지 않는다. 제공자 추가는 인증 어댑터로 구현한다.
- Prisma의 회원·소셜 계정 생성은 원자적으로 처리한다. 중복·동시성 실패는 해당 제약인지 확인한 후 도메인 오류로 변환한다. 알 수 없는 오류는 보존한다.
- HTTP 입력 검증과 도메인 오류의 HTTP 변환은 presentation에서 처리한다. 공통 필터는 오류 본문을 `{ error: { code, message, details? } }`로 통일하고 성공 응답을 감싸지 않는다. 5xx 내부 내용은 클라이언트에 노출하지 않는다.

## TypeScript와 스타일

- ESM/NodeNext. `.ts` 소스에서 로컬 모듈 import는 `.js` 확장자를 사용한다. 임의로 확장자를 생략하도록 설정을 바꾸지 않는다.
- 도메인 alias: `@users/*`, `@auth/*`, Prisma 생성 경로 `@db/*`; tsconfig.json을 기준으로 기존 방식을 따른다.
- 클래스 PascalCase, 변수·메서드 camelCase, 파일 kebab-case. 기존 `*.use-case.ts`, `*.repository.ts`, `*.controller.ts`, `*.pipe.ts` 패턴을 따른다.
- 루트 eslint.config.mjs와 .prettierrc가 스타일의 기준이다. singleQuote, 세미콜론, trailingComma all. 전체 저장소의 무관한 포맷을 변경하지 않는다.
- 사용하지 않는 **매개변수**는 `_` 접두사를 허용한다. 현재 lint 규칙은 일반 지역 변수 전체를 면제하지 않는다.
- 비동기 반환 계약은 `Promise<...>`에 맞춘다. catch에서 rejection을 처리해야 하면 `return await`가 필요할 수 있다. `unknown` 오류를 확인하고 변환한다.

## DB와 환경

PostgreSQL/Prisma. API `.env`는 개발 DB `later_dev`, `.env.test`는 테스트 DB `later_test`를 사용한다. 파일과 인증 정보는 커밋하지 않는다.
실제 URL을 출력하지 않고 URL pathname으로 대상 DB를 확인한다. 테스트 정리·삭제는 `later_test`에서만 실행하고 테스트 소유 데이터만 정리한다.
아래 Prisma 구조·설정·명령은 feat/auth에서 도입했으며 main에 auth가 병합되기 전에는 없을 수 있다. 현재 브랜치에 존재하는지 먼저 확인한다.
Prisma 설정은 `apps/api/prisma7.config.ts`, 테스트는 `prisma7.test.config.ts`다. 생성 코드는 `src/generated/prisma`이며 직접 편집하지 않는다.
스키마 변경은 migration SQL을 검토하고 데이터 손실 여부를 확인한다. reset을 정상 개발 절차로 사용하지 않는다. DB 생성에는 서버 권한이 필요하므로 ORM이 항상 DB까지 만든다고 가정하지 않는다.

API 디렉터리에서 실행하는 기존 명령:

```sh
pnpm exec prisma generate --config prisma7.config.ts
pnpm exec prisma migrate deploy --config prisma7.config.ts
pnpm exec prisma migrate deploy --config prisma7.test.config.ts
```

실제 설치된 Prisma 버전과 설정을 먼저 확인한다. 새 버전 문서의 명령을 그대로 적용하거나 무단 업그레이드하지 않는다.

## 검증

`apps/api`에서:

```sh
pnpm test
pnpm test:e2e
pnpm test:integration
pnpm exec tsc --noEmit --incremental false
pnpm exec eslint <이번 작업의 TS 파일들>
pnpm build
```

- Unit: `*.spec.ts`; application/domain 로직과 경계 동작, 외부 DB 없이 실행.
- Integration: `*.integration-spec.ts`; 실제 later_test DB에서 repository·transaction·DI 연결 검증. 환경과 migration 필요.
- E2E: `test/*.e2e-spec.ts`; 실제 Nest HTTP 경로·검증·오류 응답, 외부 소셜 API는 대체한다.
- 특정 테스트 RED/GREEN: `pnpm exec vitest run <파일>`; DB 테스트는 integration config 사용.
- Windows Supertest 연결 reset 이슈가 재발하면 기존 E2E의 Connection keep-alive와 앱 종료 처리를 확인한다. 환경 오류를 Behavior RED로 기록하지 않는다.
- 기존 Vite 경고는 실패와 구분한다. `git diff --check`로 diff를 확인한다. 명령 실패 후 커밋으로 진행하지 않는다.

## 참고 문서

로컬 계약이 우선이다. 아래 auth 문서는 auth 구현을 포함한 브랜치에서 존재하며 main에는 아직 없을 수 있다.

- `apps/api/src/common/http/README.md`: 공통 오류 계약.
- `apps/api/src/auth/presentation/http/README.md`: 로그인·갱신·로그아웃 계약.
- `apps/api/src/auth/infrastructure/tokens/README.md`: JWT 설정과 Guard의 검증 범위.
- `apps/api/prisma/schema.prisma`, 각 Module/테스트와 package.json: 실제 구현·환경의 근거.

외부 API 작업은 공식 문서와 실제 설치 버전을 확인한다:

- [NestJS](https://docs.nestjs.com/), [Vitest](https://vitest.dev/guide/), [Prisma](https://www.prisma.io/docs/).
- [Google ID 토큰 검증](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token).
- [카카오 로그인 REST API](https://developers.kakao.com/docs/latest/ko/kakaologin/rest-api), [네이버 로그인 API](https://developers.naver.com/docs/login/api/api.md).
- [OAuth 보안 RFC 9700](https://www.rfc-editor.org/rfc/rfc9700), [JWT 보안 RFC 8725](https://www.rfc-editor.org/rfc/rfc8725).
- [Expo 버전별 문서](https://docs.expo.dev/versions/).
- [Codex AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md): 루트 지침을 읽고 하위 지침을 추가 적용하는 공식 동작. 다른 Agent도 공통 문서를 명시적으로 읽는다.
