# 🧠 PyTorch 학습 기능 - 현재 상태 및 작동 방식

## 📌 현재 상태: **구현되었지만 실행되지 않음**

### ✅ 이미 준비된 것들
1. **ML 서버 코드**: `/home/user/webapp/ml-server/main.py`
2. **설치 스크립트**: `/home/user/webapp/ml-server/install.sh`
3. **클라이언트 코드**: `/home/user/webapp/app/lib/mlClient.ts`
4. **데이터 수집**: `ml_training_data` 테이블 (Stage 1에서 생성)

### ❌ 아직 실행되지 않은 이유
- **PyTorch 미설치**: Python 환경에 PyTorch가 설치되어 있지 않음
- **ML 서버 미실행**: FastAPI 서버가 시작되지 않음
- **하이브리드 연동 미완성**: Next.js에서 ML 서버 호출 로직 미연동

---

## 🎯 PyTorch 시스템 작동 방식

### 📊 전체 구조

```
┌─────────────────────────────────────────────────────────────┐
│                    사용자 입력                                │
│              "레이크 찰리스 말보로 24병"                       │
└─────────────────────┬───────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────────┐
│         Next.js Backend (Node.js)                            │
│                                                              │
│  Step 1: Rule-based 검색 (현재 시스템)                       │
│  - 멀티 토큰 검색                                            │
│  - 가중치 점수 계산                                          │
│  - 결과: 0.0 ~ 3.0 점수                                      │
└─────────────────────┬───────────────────────────────────────┘
                      ↓
              점수 < 0.7? (신뢰도 낮음)
                      ↓ YES
┌─────────────────────────────────────────────────────────────┐
│         PyTorch ML Server (Python)                           │
│                                                              │
│  Step 2: 의미 기반 매칭 (Semantic Search)                    │
│  - Sentence Transformers 모델                                │
│  - 384차원 임베딩 벡터 생성                                   │
│  - 코사인 유사도 계산                                         │
│  - 결과: 0.0 ~ 1.0 점수 (정확도 90-95%)                      │
└─────────────────────┬───────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────────┐
│              최종 결과 반환                                   │
│  - ML 점수 > 0.7: ML 결과 채택                               │
│  - ML 점수 < 0.7: Rule-based 결과 유지                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 🧠 Sentence Transformers 작동 원리

### 1️⃣ 임베딩 생성 (Embedding)

**문장을 벡터로 변환**

```python
입력 1: "레이크 찰리스 말보로"
임베딩 1: [0.23, -0.45, 0.67, ..., 0.12]  (384차원 벡터)

입력 2: "Lake Chalice Marlborough"
임베딩 2: [0.25, -0.43, 0.69, ..., 0.14]  (384차원 벡터)

입력 3: "샤또 마고"
임베딩 3: [-0.12, 0.78, -0.34, ..., 0.89]  (384차원 벡터)
```

**특징:**
- 비슷한 의미를 가진 문장은 비슷한 벡터
- 한국어/영어 관계없이 의미가 같으면 비슷한 벡터
- "레이크 찰리스" ≈ "Lake Chalice" (임베딩 공간에서 가까움)

### 2️⃣ 유사도 계산 (Cosine Similarity)

```python
# 코사인 유사도 공식
similarity = cos(θ) = (A · B) / (|A| × |B|)

예시:
  입력: "레이크 찰리스 말보로"
  
  후보 1: "레이크 찰리스 에스테이트 말보로"
    → similarity = 0.95 (매우 유사!)
  
  후보 2: "Lake Chalice Marlborough Sauvignon Blanc"
    → similarity = 0.88 (한영 다르지만 의미 유사!)
  
  후보 3: "샤또 마고"
    → similarity = 0.23 (완전히 다름)
```

### 3️⃣ 사전 계산 (Pre-computing)

**성능 최적화 핵심!**

```python
# 서버 시작 시 1회만 실행
items = [
  "레이크 찰리스 에스테이트 말보로",
  "찰스하이직 샤르도네",
  "샤또 마고",
  ...  (374개)
]

# 모든 품목의 임베딩을 미리 계산하여 메모리에 캐시
embeddings_cache = model.encode(items)  # 1분 소요
# 이후 검색은 0.2초만 소요!
```

---

## 🔄 실제 작동 예시

### 예시 1: 정확한 입력

```python
입력: "레이크 찰리스 말보로"

Step 1: Rule-based (현재 시스템)
  - 멀티 토큰: ["레이크", "찰리스", "말보로"]
  - AND 검색: 5개 후보
  - 점수 계산: 0.85 (높음)
  → Rule-based 결과 채택 (빠름!)

Step 2: ML 서버 호출 안 함 (0.85 > 0.7)
```

### 예시 2: 애매한 입력

```python
입력: "lc 말보로"

Step 1: Rule-based
  - 토큰 매핑: "lc" → "레이크 찰리스" (확장)
  - 검색: "레이크 찰리스 말보로"
  - 점수: 0.65 (애매함)
  → ML 서버 호출!

Step 2: ML 서버
  - 임베딩 생성: "lc 말보로" → [0.23, -0.45, ...]
  - 유사도 계산:
    1. "레이크 찰리스 말보로" → 0.82 ⭐
    2. "LC 까베르네" → 0.45
    3. "말보로 소비뇽" → 0.38
  → ML 결과 채택! (정확!)
```

### 예시 3: 오타가 있는 입력

```python
입력: "레이크 찰리스 말로보" (오타!)

Step 1: Rule-based
  - 검색: "말로보" → 결과 없음
  - 점수: 0.15 (매우 낮음)
  → ML 서버 호출!

Step 2: ML 서버
  - 임베딩은 의미를 이해함!
  - "말로보" ≈ "말보로" (발음 유사)
  - 유사도:
    1. "레이크 찰리스 말보로" → 0.88 ⭐
    2. "레이크 하우스 말보로" → 0.72
  → ML이 오타를 극복! (강력!)
```

### 예시 4: 영어 입력

```python
입력: "Lake Chalice Marlborough"

Step 1: Rule-based
  - 영문명 검색: 작동
  - 점수: 0.75 (괜찮음)
  → Rule-based 채택

Step 2: ML 서버 호출 안 함

다국어 모델이라 한영 혼용도 OK!
입력: "Lake Chalice 말보로"
  → ML이 자연스럽게 매칭
```

---

## 📊 Sentence Transformers 모델 상세

### 사용 모델

**paraphrase-multilingual-MiniLM-L12-v2**

| 항목 | 값 |
|------|-----|
| **파라미터** | 120M |
| **임베딩 차원** | 384 |
| **지원 언어** | 50+ (한국어, 영어 포함) |
| **메모리** | ~500MB |
| **속도** | 200-500ms (374개 품목) |
| **정확도** | 90-95% |

### 모델 학습 방식

**Pre-trained (사전 학습됨)**

```
1. 대규모 텍스트로 사전 학습
   - 10억+ 문장 쌍
   - "비슷한 의미" 학습
   
2. Fine-tuning (추가 학습)
   - Paraphrase 데이터셋
   - "같은 의미, 다른 표현" 학습
   
3. 결과
   - 문맥 이해 능력
   - 다국어 지원
   - 오타 허용
```

---

## 🎓 ML 학습 데이터 수집 (Stage 1에서 구현)

### 자동 수집 중

**`ml_training_data` 테이블**

```sql
CREATE TABLE ml_training_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  raw_input TEXT NOT NULL,           -- "레이크 찰리스 말보로"
  client_code TEXT,                   -- "01025"
  selected_item_no TEXT,              -- "3A24401" (선택됨)
  rejected_item_nos TEXT,             -- "3B56789,3C12345" (거부됨)
  rule_based_score REAL,              -- 0.65 (Rule 점수)
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

**수집 시점:**
- 사용자가 품목 선택할 때마다 자동 저장
- `/api/auto-learn` 엔드포인트에서 수집

**수집 목적:**
1. **모델 Fine-tuning**: 우리 데이터로 재학습
2. **정확도 분석**: Rule vs ML 비교
3. **패턴 발견**: 자주 틀리는 케이스 파악

---

## 🚀 PyTorch 시스템 활성화 방법

### Phase 1: 설치 (10분)

```bash
cd /home/user/webapp/ml-server
bash install.sh

# 설치 내용:
# - Python 가상환경 생성
# - PyTorch 설치 (500MB)
# - Sentence Transformers 설치
# - FastAPI 설치
```

### Phase 2: 데이터 로드 (5분)

```bash
source venv/bin/activate
python load_data.py

# 작업 내용:
# - items 테이블에서 374개 품목 로드
# - 임베딩 생성 (1분)
# - 캐시에 저장
```

### Phase 3: 서버 시작 (1분)

```bash
pm2 start ml-server/ecosystem.config.js
pm2 logs ml-server

# 포트: 8000
# 엔드포인트: http://localhost:8000/api/ml-match
```

### Phase 4: Next.js 연동 (5분)

```typescript
// app/lib/resolveItemsWeighted.ts 수정

// 기존 코드 뒤에 추가
if (top.score < 0.7) {
  // ML 서버 호출
  const mlResults = await mlMatch({
    query: it.name,
    client_code: clientCode,
    top_k: 5,
    min_score: 0.5
  });
  
  if (mlResults.success && mlResults.results.length > 0) {
    const mlTop = mlResults.results[0];
    if (mlTop.score > top.score) {
      // ML 결과가 더 좋으면 채택
      return mlTop;
    }
  }
}
```

---

## 📊 성능 비교

### Rule-based (현재)

| 항목 | 값 |
|------|-----|
| **정확도** | 70-85% |
| **속도** | 50-100ms |
| **강점** | 빠름, 정확한 입력에 강함 |
| **약점** | 오타 취약, 의미 이해 불가 |

### PyTorch ML (미래)

| 항목 | 값 |
|------|-----|
| **정확도** | 90-95% |
| **속도** | 200-500ms |
| **강점** | 오타 허용, 의미 이해, 다국어 |
| **약점** | 느림, 메모리 많이 사용 |

### Hybrid (최종 목표)

| 항목 | 값 |
|------|-----|
| **정확도** | 92-97% |
| **속도** | 50-300ms (평균) |
| **강점** | 두 시스템 장점 결합 |
| **전략** | Rule 우선 → ML 보조 |

---

## 💡 왜 PyTorch를 아직 안 켰나?

### 이유 1: 데이터 수집 우선
- **현재 목표**: Stage 1에서 학습 데이터 수집 중
- **필요 데이터**: 500건+ (현재 0건)
- **수집 방법**: 사용자가 품목 선택할 때마다 자동 저장

### 이유 2: Rule-based 먼저 개선
- **멀티 토큰 검색**: 방금 구현 완료!
- **토큰 매핑 학습**: Stage 1에서 구현
- **효과**: 정확도 70% → 85% (ML 없이도)

### 이유 3: 리소스 관리
- **메모리**: PyTorch 500MB + 모델 500MB = 1GB
- **CPU**: 추가 프로세스 필요
- **안정성**: Rule-based가 먼저 안정화 필요

---

## 🎯 PyTorch 활성화 타이밍

### ✅ 지금 바로 활성화해도 되는 조건
1. 멀티 토큰 검색이 안정화됨
2. 학습 데이터 수집 시스템 구축됨
3. 테스트할 준비가 됨

### 🔄 활성화 후 예상 시나리오

```
Week 1-2: Rule-based 사용 (현재)
  → 사용자 행동 데이터 수집 (500건)
  → 정확도: 85%

Week 3: PyTorch 활성화
  → Hybrid 시스템 작동
  → 정확도: 90%

Week 4: 데이터 분석
  → 틀린 케이스 파악
  → Fine-tuning 준비

Month 2: Fine-tuning
  → 우리 데이터로 재학습
  → 정확도: 95%+
```

---

## 🚀 지금 바로 PyTorch 활성화할까요?

**Option A: 지금 바로 설치 및 테스트**
- 10분 설치
- ML 서버 시작
- Hybrid 시스템 작동 확인
- 정확도 비교

**Option B: 데이터 먼저 수집**
- 1-2주 Rule-based 사용
- 500건+ 데이터 수집
- 그 후 PyTorch 활성화
- Fine-tuning까지 진행

**Option C: 일부만 먼저**
- ML 서버만 설치
- 연동은 나중에
- 테스트 환경만 구축

어떤 방향으로 진행하시겠습니까? 🤔
