# 나중에 – 2차 기획: BM 및 장소 액션 기능 추가

- 작성일: 2026-10-03
- 기존 기획: [서비스 기획 초안](서비스_기획_초안.md)
- 문서 성격: 제품 방향과 설계 제안. 구현 완료를 의미하지 않는다.
- 100개, 30일, 7일 및 삭제 유예기간은 예시이며 최종 정책은 별도 확정한다.

## 1. BM 방향

기본 저장 기능은 무료로 제공하되 무료 사용자는 보관 개수 또는 보관 기간에 제한을 둔다. 유료 구독자는 구독 중 해당 제한 없이 콘텐츠 라이브러리를 유지한다.

무료 정책 후보:

- 최근 100개 콘텐츠까지 보관.
- 저장 후 30일간 보관.
- 위 정책 중 하나 또는 “100개 / 30일 중 먼저 도달하는 조건” 적용.
- 제한을 초과한 콘텐츠는 자동 만료 대상으로 처리하고 만료 전에 안내.

안내 예: “이 콘텐츠는 3일 후 보관 기간이 종료됩니다.”

SavedItem의 보관 생명주기:

```text
ACTIVE → EXPIRING → EXPIRED → DELETED
```

갑자기 삭제되는 경험을 방지하기 위해 삭제 유예기간을 고려한다.

```text
저장 → 30일 무료 보관 → 7일 만료 예정 → 만료 → 일정 유예기간 후 실제 데이터 삭제
```

위 흐름은 예시다. 7일 안내가 30일 보관 기간 안에 포함되는지, 이후 추가 기간인지와 실제 삭제 시점은 정책 확정 시 명시한다.

## 2. 구독 서비스

가칭은 “나중에+”, “Later+”, “나중에 Plus”이며 최종 명칭은 미정이다.

| 기능 / 정책 | Free | Plus |
| --- | --- | --- |
| 콘텐츠 저장 | 보관 개수 제한 | 무제한 저장 |
| 보관 기간 | 기간 제한 | 구독 중 보관기간 제한 없음 |
| AI 자동 분석 | 제공 | 제공 |
| 태그 / 카테고리 | 제공 | 제공 |
| 벡터 검색 | 제공 | 제공 |
| 장소 액션 | 제공 | 제공 |

Free의 실제 개수·기간 제한 조합은 1절의 후보 중 결정한다.

향후 Plus 전용 기능 후보:

- 대용량 이미지 저장
- 고화질 원본 저장
- 고급 AI 검색
- 자동 컬렉션
- 다중 디바이스 동기화
- 저장 데이터 Export

초기에는 기능 차이를 과도하게 만들기보다 “저장 기간 / 저장 개수 제한 해제”를 명확한 구독 가치로 제공한다. 구독 해지 후에도 영원히 저장하는 구조가 아니라면 서비스 문구는 **“영구 보관” 대신 “구독 중 보관기간 제한 없음”**으로 표현한다.

## 3. 구독 해지 정책

구독 해지 시 기존 데이터를 즉시 삭제하지 않는다.

```text
Plus 구독 → 구독 해지 → 결제 기간 종료까지 Plus 유지 → Free 전환 → 무료 저장 정책 적용
```

무료 한도를 초과하면 오래된 콘텐츠부터 만료 대상으로 변경한다. 개수 제한 정책의 예:

```text
SavedItem 630개 → Plus 해지 → 결제 기간 종료 → Free 한도 100개
최근 100개 ACTIVE / 나머지 530개 EXPIRING
```

사용자에게 삭제 예정 데이터와 예정 시점을 명확하게 보여준다. 기간 제한을 함께 적용하는 경우 기존 저장물의 만료일 계산과 전환 유예기간은 추가로 확정한다.

## 4. 데이터 모델 추가

구독 정보는 별도 도메인으로 관리한다.

```text
User ─ Subscription

Subscription {
  id
  userId
  plan: FREE | PLUS
  status: ACTIVE | CANCELLED | EXPIRED
  startedAt
  expiresAt
}

SavedItem {
  id
  userId
  contentId
  savedAt
  expiresAt
  retentionStatus
}

RetentionStatus = ACTIVE | EXPIRING | EXPIRED
```

- Plus: `SavedItem.expiresAt = null`.
- Free 기간 제한: `SavedItem.expiresAt = savedAt + 보관기간`.
- 개수 제한은 별도의 한도 판정으로 만료 대상을 선정한다.
- `DELETED`는 실제 삭제 이후의 생명주기 단계다. 삭제 기록을 별도로 남길지는 미정이며 위 RetentionStatus 예시에는 포함하지 않는다.
- Subscription의 CANCELLED와 결제 기간 종료 전 Plus 이용 권한을 구분해 설계한다.

필드와 상태는 개념 모델이며 결제 연동 및 상세 전이 규칙은 구현 전에 확정한다.

## 5. 콘텐츠 만료 처리

NestJS Scheduler 또는 BullMQ로 만료 데이터를 처리한다.

```text
Scheduler / BullMQ
 → 만료 대상 SavedItem 검색
 → EXPIRING / EXPIRED 처리
 → 유예기간 확인
 → SavedItem 삭제
```

Content와 SavedItem은 분리한다. 동일한 공개 URL을 여러 사용자가 저장했을 때 한 사용자의 만료가 공통 Content 삭제로 이어지면 안 된다.

```text
User A → SavedItem A ─┐
User B → SavedItem B ─┼→ Content A
User C → SavedItem C ─┘
```

User A의 보관 기간이 만료되면 SavedItem A만 삭제한다. 다른 사용자의 참조가 남아 있으면 Content A를 유지한다. SavedItem 참조 수가 0이 되면 Content와 관련 데이터를 삭제 대상으로 만들 수 있다. 개인 이미지·텍스트의 소유권 분리 원칙은 기존 기획을 따른다.

## 6. 장소 콘텐츠 인식

기존 분석 파이프라인에 장소 포함 여부 판단과 Place Entity 추출을 추가한다.

```text
SavedItem 생성 → Content 확인 / 생성 → Metadata 추출 → 본문 / 설명 추출
 → AI 분석(요약 / 카테고리 / 태그 / 엔티티 / 장소 포함 여부 / Place Entity)
 → Embedding → pgvector
```

예시 콘텐츠: “성수동에서 분위기 좋은 카레집 ‘카린지’, 서울 성동구...”

AI 분석 결과 예시(실제 장소 검증 결과가 아님):

```json
{
  "contentType": "PLACE",
  "places": [
    {
      "name": "카린지",
      "address": "서울 성동구 ...",
      "category": "restaurant"
    }
  ]
}
```

## 7. 장소 데이터

Content 분석 결과에 장소 정보를 저장한다. 하나의 콘텐츠에 여러 장소가 포함될 수 있으므로 `Content : ContentPlace = 1 : N` 구조로 설계한다.

```text
Content ─ ContentPlace[]

ContentPlace {
  id
  contentId
  name
  address
  latitude
  longitude
  category
  confidence
}
```

좌표와 주소는 장소를 검증하기 전 확정값으로 취급하지 않는다. 미확정 값의 표현과 confidence 기준은 상세 설계에서 결정한다.

## 8. 네이버 지도 액션

장소가 포함된 SavedItem에는 장소 액션 버튼을 노출한다.

```text
┌────────────────────────────┐
│ 성수동 카레집 추천          │
│ 카린지                     │
│ 서울 성동구 ...            │
│ [ 네이버 지도에서 보기 ]   │
└────────────────────────────┘
```

버튼을 누르면 해당 장소를 네이버 지도에서 검색한다.

```text
나중에 App → 네이버 지도 열기 → “카린지 성수” 검색
```

모바일에서는 가능한 경우 네이버지도 앱을 실행하고, 설치되지 않은 경우 네이버지도 Web으로 fallback한다. 실제 앱 링크·웹 링크 형식 및 지원 환경은 구현 시 공식 문서로 검증한다.

## 9. 장소 정보 신뢰도

AI 추출 결과만으로 좌표를 확정하지 않고 장소 검색 결과와 결합한다.

```text
AI 장소 추출 → 장소 검색 → 후보 장소 검색 → 주소 / 상호 / 지역 비교 → ContentPlace 확정
```

예: Instagram 본문 “성수 카린지 존맛”에서 `name = 카린지`, `region = 성수`를 추출하고 지도 검색 결과와 비교해 실제 장소를 특정한다.

확신도가 낮으면 특정 장소나 좌표를 단정하지 않고 네이버 지도에서 “성수 카린지” 검색만 수행한다.

## 10. 콘텐츠 액션 개념

저장 데이터를 콘텐츠 의미에 맞는 행동으로 연결한다.

| 콘텐츠 의미 | 액션 예시 |
| --- | --- |
| PLACE | 지도에서 보기 |
| PRODUCT | 상품 보기 |
| VIDEO | YouTube 열기 |
| RESTAURANT | 지도에서 보기 |
| EVENT | 일정 추가 |
| ARTICLE | 원문 보기 |

공통 ContentAction 개념으로 콘텐츠별 버튼을 처리할 수 있다.

```text
ContentAction {
  type: OPEN_URL | OPEN_MAP | ADD_CALENDAR
  label
  payload
}

Content → ContentAction[]
Instagram 맛집 → OPEN_MAP
YouTube → OPEN_URL
공연 정보 → OPEN_MAP + ADD_CALENDAR
```

payload의 타입별 구조는 상세 설계에서 정의한다. 장소 액션부터 시작하고 상품·일정 액션은 장기 확장 방향으로 둔다.

## 11. 전체 서비스 구조

```text
Instagram / YouTube / Safari / Chrome / 사진
 → 공유하기 → 나중에 → SavedItem → Content 확인 / 생성 → BullMQ
 → 콘텐츠 자동 분석
    ├─ 요약
    ├─ 태그 / 카테고리
    └─ 엔티티 → 장소 → ContentPlace
 → Embedding → pgvector
```

공통 공개 Content가 있으면 기존 데이터를 재사용한다. 도식은 개념 흐름이며 생성 순서와 트랜잭션 설계는 기존 저장 경로와 함께 결정한다.

사용자가 다시 조회할 때:

```text
SavedItem → AI 요약 / 태그 / 카테고리 → ContentAction
 → [원문 보기] / [네이버 지도에서 보기]
```

## 12. 비즈니스 모델

“나중에”는 사용자가 인터넷에서 발견한 콘텐츠를 저장하고 AI가 자동으로 정리해주는 개인 콘텐츠 보관함이며, 무료 사용자는 제한된 기간 또는 개수만 저장할 수 있고 구독 사용자는 구독 중 보관 제한 없이 자신의 콘텐츠 라이브러리를 유지할 수 있다.

저장한 콘텐츠를 다시 찾는 것에서 끝나는 것이 아니라, 장소·상품·일정 등 콘텐츠의 의미에 맞는 행동까지 바로 연결한다.

```text
SAVE → UNDERSTAND → ORGANIZE → SEARCH → ACTION
```
