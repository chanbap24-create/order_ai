# 학습 시스템 체크리스트

## ✅ 구현 확인됨

### 1. 학습 API 엔드포인트
- `/api/learn-item-alias` - 품목 별칭 학습 (POST)
- `/api/learn-search` - 검색 학습 (POST)  
- `/api/learn-new-item` - 신규 품목 학습 (POST)
- `/api/learn-client` - 거래처 학습 (POST, GET, DELETE)

### 2. 학습 데이터 저장
- `item_alias` 테이블: 품목 별칭 저장
  - alias (TEXT PRIMARY KEY)
  - canonical (TEXT NOT NULL) - 품목 코드
  - count (INTEGER) - 사용 횟수
  - last_used_at (TEXT)
  
- `search_learning` 테이블: 검색 학습
  - search_key (TEXT)
  - item_no (TEXT)
  - hit_count (INTEGER)
  - last_used_at (TEXT)

### 3. 학습 적용 로직 (resolveItemsWeighted.ts)

#### Exact Match (kind: "exact")
- 학습된 별칭과 입력이 정확히 일치
- **점수: 1.0 (즉시 확정)**
- 예: "lc" → "30864" (레이크 찰리스 품목코드)

#### Contains Specific (kind: "contains_specific")
- 학습된 별칭이 입력에 포함됨 (구체적)
- **즉시 확정**
- 예: "말보로 에스테이트" → "3A24401"

#### Contains Weak (kind: "contains_weak")
- 학습된 별칭이 입력에 포함됨 (일반적)
- 가중치 시스템에서 **보너스 점수 추가**
- 자동확정 조건 강화: score >= 0.88 && gap >= 0.30

### 4. 프론트엔드 학습 트리거
- 후보 클릭 시 `learnSelectedAlias()` 호출
- 신규 품목 저장 시 `/api/learn-new-item` 호출
- 기존 품목 선택 시 `/api/learn-item-alias` 호출

## 🧪 테스트 시나리오

### 시나리오 1: 거래처 별칭 학습
1. 거래처 입력: "lc"
2. 거래처 선택: "레이크 찰리스 (30864)"
3. 학습 저장 확인
4. 다시 "lc" 입력 시 자동 인식 확인

### 시나리오 2: 품목 별칭 학습
1. 품목 입력: "말보로"
2. 후보 선택: "3A24401 말보로 에스테이트..."
3. 학습 저장 확인
4. 다시 "말보로 24병" 입력 시 즉시 확정 확인

### 시나리오 3: 신규 품목 학습
1. 품목 입력: "레이크 찰리스 에스테이트 리저브"
2. 신규품목 후보 선택
3. 가격 입력 및 저장
4. 다시 같은 품목 입력 시 자동 인식 확인

## ⚠️ 확인 필요 사항

1. 학습 데이터가 실제로 DB에 저장되는지
2. 학습 후 다음 발주에서 적용되는지
3. 학습 카운트가 증가하는지
4. GAP 기반 규칙과 학습 규칙의 우선순위

## 📝 다음 단계

학습 데이터를 실제로 확인하기 위해:
- 브라우저 개발자 도구에서 Network 탭 확인
- `/api/learn-item-alias` 응답 확인
- PM2 로그에서 학습 관련 로그 확인
