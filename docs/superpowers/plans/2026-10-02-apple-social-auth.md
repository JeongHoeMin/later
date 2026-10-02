# Apple 로그인 Implementation Plan

> REQUIRED SUB-SKILL: superpowers:executing-plans. 단계마다 TDD 실행.

**Goal:** 기존 서버 로그인에 Apple ID 토큰·서버 nonce 보호 추가.
**Architecture:** application 포트·시작 usecase, infrastructure Prisma·생성기·Apple JWT 어댑터, HTTP·AuthModule DI.
**Tech Stack:** NestJS, jose 6.2.12, Prisma 7.10.0, PostgreSQL, Vitest.
**Spec:** ../../../.agent/tasks/TASK-01M3X599CCKHC50NX77KD3AGJX-apple-social-auth/requirement.md

## Global Constraints

feat/auth 재사용·scaffold 보존·generated 직접 편집 금지·비파괴 migration·later_test·새 의존성 없음·nonce 해시만 DB 저장.

## Task 1 - 시도·Apple 검증

- [x] 포트 create({id,nonceHash,expiresAt}), consume(id,nonceHash,now):Promise<boolean>, generator.generate():{id,nonce,nonceHash} 선언.
- [x] StartAppleLoginUseCase.execute()와 AppleAuthProvider.authenticate(token,attemptId) 최소 선언·테스트. 실제 RSA claims·서명·nonce·시도·JWKS 장애 RED 기대 실패 확인.
- [x] 5분 TTL·생성기·고정 JWKS RS256 검증 후 원자 소비 구현. 관련 Unit GREEN.

## Task 2 - DB·HTTP

- [x] apple 입력 보존·설정 누락 테스트 RED 확인.
- [x] domain provider·Prisma enum apple, AppleLoginAttempt UUID id/nonceHash char64/expiresAt/usedAt/createdAt 추가. SQL 검토·generate·dev/test deploy.
- [x] 저장소 최소 선언·DB integration RED 확인. 조건부 updateMany 구현·불일치·만료 경계·동시 소비·apple 회원 저장 GREEN.
- [x] POST /auth/social/apple/start 무본문·201, loginAttemptId UUID 입력·command 전달·DI. 실제 JWT E2E 신규/기존·재사용·401/503·400 RED 확인 후 GREEN.

## Task 3 - 완료

- [x] HTTP README·social-login-process.md·.env.example·project 목표 갱신. SDK 해시·미구현·설정·재시도 설명.
- [x] Unit/E2E/integration 전체·tsc·변경 TS lint·build·포맷·diff 모두 PASS.
- [x] fresh reviewer, 필요하면 회귀 RED→GREEN. 네 문서 갱신·명시적 stage·한국어 로컬 커밋. push 제외.
