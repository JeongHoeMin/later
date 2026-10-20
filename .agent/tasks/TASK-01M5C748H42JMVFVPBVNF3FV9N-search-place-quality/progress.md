# Progress

## Current State

pending / requirement. 사용자가 남은 작업을 Task로 등록하도록 명시적으로 요청했다.

## Decisions

Decision: multilingual-e5-small+pgvector를 기준으로 문서/질의 전처리·모델 실행 자원·색인·검색 계약·평가 데이터를 설계한다. 부산의 고깃집 등 지역+업종 필수 목표, 복수 장소/지점 대조·지도 액션·출처 특징 태그 표시를 구체화한다.

Reason: MVP 문서 정리와 후속 설계/구현을 분리해 추적한다.

## Remaining

사용자 직접 태그 입력은 제외한다. 검색/장소 품질은 고정 데이터셋·평가 기준과 실패 사례로 검증한다.

## Service Policy Update

해당 없음: 후속 작업 등록만 수행한다.

## Service Architecture Update

해당 없음: 코드/구성 변경 없음.

## Issues / Blocker

외부 장애 없음. 미확정 또는 보류 조건은 위에 기록했다.

## Next Action

T-R1-1은 NOT_STARTED. requirement.md와 [MVP](../../../docs/mvp.md)를 확인해 미확정 사항을 논의한다. 제품 구현은 별도 설계/착수 범위를 확정한 뒤 진행한다.
