# 🧠 PyTorch 기반 품목 매칭 학습 시스템 설계

## 🎯 **왜 PyTorch인가?**

### **기존 방식의 한계**
```
규칙 기반:
- "ch" → "찰스하이직" (하드코딩)
- "bl" → "로쉬벨렌" (하드코딩)
- 새로운 약어마다 수동 매핑 필요 ❌

점수 계산:
- 문자열 유사도 계산 (고정된 알고리즘)
- 학습이 쌓여도 알고리즘 자체는 개선 안됨 ❌
```

### **PyTorch 기반의 장점**
```
임베딩 학습:
- "ch", "찰스하이직", "Charles Heidsieck" 모두 같은 벡터 공간에 매핑
- 새로운 약어도 자동으로 유사도 계산 ✅

모델 학습:
- 사용자 선택 데이터로 모델 자체가 개선됨
- 학습 쌓일수록 모델이 점점 똑똑해짐 ✅

패턴 인식:
- "ch 샤르도네"와 "ch 까베"가 다른 결과임을 자동 학습
- 컨텍스트 이해 능력 ✅
```

---

## 🏗️ **시스템 아키텍처**

### **전체 구조**
```
┌─────────────────────────────────────────────────────────┐
│                   입력 레이어                            │
│  사용자 입력: "ch 샤르도네 24병"                         │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│              전처리 & 토큰화                             │
│  - 수량 제거: "ch 샤르도네"                              │
│  - 토큰 분해: ["ch", "샤르도네"]                         │
│  - 정규화: 소문자 변환, 공백 정리                        │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│          PyTorch 임베딩 레이어 🧠                        │
│  Token → Vector 변환                                     │
│  - "ch" → [0.23, -0.45, 0.78, ...]  (128차원)          │
│  - "샤르도네" → [0.12, 0.67, -0.34, ...]                │
│  - "찰스하이직" → [0.25, -0.43, 0.81, ...]  (ch와 유사!) │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│           유사도 계산 레이어                             │
│  입력 임베딩 vs 품목 임베딩 코사인 유사도                │
│  - ["ch", "샤르도네"] vs "찰스하이직 샤르도네" → 0.92   │
│  - ["ch", "샤르도네"] vs "샤또 샤르도네" → 0.45         │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│           랭킹 모델 (Neural Network) 🧠                  │
│  Input: [유사도, 최근구매, 구매빈도, 빈티지, ...]        │
│  Hidden Layers: 128 → 64 → 32                           │
│  Output: 최종 점수 (0~1)                                 │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│              결과 + 학습 피드백                          │
│  사용자 선택 → 모델 학습 (Backpropagation)               │
│  - 선택된 품목: Positive label (1.0)                     │
│  - 무시된 품목: Negative label (0.0)                     │
│  - Loss 계산 → 가중치 업데이트                           │
└─────────────────────────────────────────────────────────┘
```

---

## 🎓 **핵심 모델: Dual-Encoder Architecture**

### **1. Query Encoder (입력 인코더)**
```python
class QueryEncoder(nn.Module):
    def __init__(self, vocab_size, embed_dim=128):
        super().__init__()
        self.embedding = nn.Embedding(vocab_size, embed_dim)
        self.lstm = nn.LSTM(embed_dim, embed_dim, batch_first=True)
        self.fc = nn.Linear(embed_dim, embed_dim)
        
    def forward(self, tokens):
        # tokens: ["ch", "샤르도네"] → [token_ids]
        embedded = self.embedding(tokens)  # [batch, seq_len, embed_dim]
        _, (hidden, _) = self.lstm(embedded)  # [1, batch, embed_dim]
        query_vec = self.fc(hidden.squeeze(0))  # [batch, embed_dim]
        return query_vec  # 입력을 하나의 벡터로 압축
```

### **2. Item Encoder (품목 인코더)**
```python
class ItemEncoder(nn.Module):
    def __init__(self, vocab_size, embed_dim=128):
        super().__init__()
        self.embedding = nn.Embedding(vocab_size, embed_dim)
        self.lstm = nn.LSTM(embed_dim, embed_dim, batch_first=True)
        self.fc = nn.Linear(embed_dim, embed_dim)
        
    def forward(self, tokens):
        # tokens: "찰스하이직 샤르도네 2022" → [token_ids]
        embedded = self.embedding(tokens)
        _, (hidden, _) = self.lstm(embedded)
        item_vec = self.fc(hidden.squeeze(0))
        return item_vec  # 품목을 하나의 벡터로 압축
```

### **3. Similarity + Ranking Model**
```python
class ItemMatchingModel(nn.Module):
    def __init__(self, vocab_size, embed_dim=128):
        super().__init__()
        self.query_encoder = QueryEncoder(vocab_size, embed_dim)
        self.item_encoder = ItemEncoder(vocab_size, embed_dim)
        
        # 추가 시그널 통합 (구매 이력, 빈티지 등)
        self.ranker = nn.Sequential(
            nn.Linear(embed_dim + 5, 64),  # embed + 5개 추가 특징
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(64, 32),
            nn.ReLU(),
            nn.Linear(32, 1),
            nn.Sigmoid()  # 0~1 점수
        )
    
    def forward(self, query_tokens, item_tokens, features):
        # 임베딩 계산
        query_vec = self.query_encoder(query_tokens)
        item_vec = self.item_encoder(item_tokens)
        
        # 코사인 유사도
        similarity = F.cosine_similarity(query_vec, item_vec, dim=1)
        
        # 추가 특징과 결합
        # features: [recent_purchase, frequency, vintage, ...]
        combined = torch.cat([query_vec, features], dim=1)
        
        # 최종 점수
        score = self.ranker(combined)
        return score, similarity
```

---

## 📊 **학습 프로세스**

### **1. 초기 데이터 준비**
```python
# 기존 거래 이력으로 초기 학습
training_data = [
    {
        "query": "ch 샤르도네",
        "positive_item": "3A24401 찰스하이직 샤르도네 2022",
        "negative_items": [
            "3B12345 샤또 샤르도네 2021",
            "3C67890 로제 샤르도네 2020"
        ],
        "features": {
            "recent_purchase": 0.8,
            "frequency": 0.9,
            "vintage": 0.7
        }
    },
    # ... 더 많은 데이터
]
```

### **2. 학습 루프**
```python
def train_epoch(model, dataloader, optimizer, criterion):
    model.train()
    total_loss = 0
    
    for batch in dataloader:
        query_tokens = batch['query_tokens']
        positive_item = batch['positive_item']
        negative_items = batch['negative_items']
        features = batch['features']
        
        # Positive 예측
        pos_score, pos_sim = model(query_tokens, positive_item, features)
        
        # Negative 예측들
        neg_scores = []
        for neg_item in negative_items:
            neg_score, _ = model(query_tokens, neg_item, features)
            neg_scores.append(neg_score)
        
        # Triplet Loss or Contrastive Loss
        # Positive는 1에 가깝게, Negative는 0에 가깝게
        loss = criterion(pos_score, torch.ones_like(pos_score))
        for neg_score in neg_scores:
            loss += criterion(neg_score, torch.zeros_like(neg_score))
        
        # Backpropagation
        optimizer.zero_grad()
        loss.backward()
        optimizer.step()
        
        total_loss += loss.item()
    
    return total_loss / len(dataloader)
```

### **3. 실시간 학습 (Online Learning)**
```python
def update_model_with_user_selection(
    model, 
    query: str, 
    selected_item: str,
    rejected_items: List[str]
):
    """
    사용자가 후보를 선택할 때마다 모델 업데이트
    """
    model.train()
    
    # 데이터 준비
    query_tokens = tokenize(query)
    selected_tokens = tokenize(selected_item)
    
    # Forward
    score, _ = model(query_tokens, selected_tokens, features)
    
    # Loss (선택된 품목은 1.0에 가까워야 함)
    loss = F.binary_cross_entropy(score, torch.tensor([1.0]))
    
    # 거부된 품목들은 0.0에 가까워야 함
    for rejected in rejected_items:
        rejected_tokens = tokenize(rejected)
        rej_score, _ = model(query_tokens, rejected_tokens, features)
        loss += F.binary_cross_entropy(rej_score, torch.tensor([0.0]))
    
    # Backprop
    optimizer.zero_grad()
    loss.backward()
    optimizer.step()
    
    # 모델 저장 (주기적으로)
    if should_save():
        torch.save(model.state_dict(), 'model_weights.pth')
```

---

## 🚀 **시스템 통합 (TypeScript + Python)**

### **아키텍처**
```
TypeScript (Hono)
    ↓ HTTP Request
Python FastAPI
    ↓
PyTorch Model
    ↓ 예측 결과
TypeScript
```

### **1. Python API 서버 (FastAPI)**
```python
# app/ml/api.py
from fastapi import FastAPI
from pydantic import BaseModel
import torch

app = FastAPI()

# 모델 로드
model = ItemMatchingModel.load('model_weights.pth')
model.eval()

class PredictRequest(BaseModel):
    query: str
    candidate_items: List[str]
    features: Dict[str, float]

@app.post("/predict")
async def predict(request: PredictRequest):
    query_tokens = tokenize(request.query)
    
    results = []
    for item in request.candidate_items:
        item_tokens = tokenize(item)
        features = torch.tensor([request.features.values()])
        
        with torch.no_grad():
            score, similarity = model(query_tokens, item_tokens, features)
        
        results.append({
            "item": item,
            "score": float(score),
            "similarity": float(similarity)
        })
    
    # 점수순 정렬
    results.sort(key=lambda x: x['score'], reverse=True)
    return {"predictions": results}

@app.post("/learn")
async def learn(request: LearnRequest):
    """사용자 선택 시 모델 업데이트"""
    update_model_with_user_selection(
        model,
        request.query,
        request.selected_item,
        request.rejected_items
    )
    return {"status": "learned"}
```

### **2. TypeScript 통합**
```typescript
// app/lib/mlPredictor.ts
export async function predictWithML(
  query: string,
  candidates: Array<{ item_no: string; item_name: string }>,
  features: {
    recentPurchase: number;
    frequency: number;
    vintage: number;
  }
): Promise<Array<{ item_no: string; item_name: string; score: number }>> {
  
  // Python API 호출
  const response = await fetch('http://localhost:8000/predict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      candidate_items: candidates.map(c => c.item_name),
      features
    })
  });
  
  const result = await response.json();
  
  // 결과 매핑
  return result.predictions.map((pred: any, idx: number) => ({
    ...candidates[idx],
    score: pred.score
  }));
}

// 사용자 선택 시 학습
export async function learnFromSelection(
  query: string,
  selectedItem: string,
  rejectedItems: string[]
) {
  await fetch('http://localhost:8000/learn', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      selected_item: selectedItem,
      rejected_items: rejectedItems
    })
  });
}
```

### **3. resolveItemsWeighted.ts 통합**
```typescript
// app/lib/resolveItemsWeighted.ts
import { predictWithML, learnFromSelection } from './mlPredictor';

export function resolveItemsByClientWeighted(...) {
  return items.map(async (it) => {
    // 기존 후보 풀 구축
    const pool = [...clientRows, ...masterRows, ...englishRows];
    
    // 🧠 PyTorch 모델로 예측
    const mlPredictions = await predictWithML(
      it.name,
      pool,
      {
        recentPurchase: getRecentPurchaseScore(clientCode, item_no),
        frequency: getFrequencyScore(clientCode, item_no),
        vintage: getVintageScore(it.name, item_no)
      }
    );
    
    // ML 점수와 기존 점수 결합 (앙상블)
    const finalScored = mlPredictions.map(pred => {
      const baseScore = calculateBaseScore(it.name, pred.item_name);
      const mlScore = pred.score;
      
      // 가중 평균 (ML 70%, 기존 30%)
      const finalScore = mlScore * 0.7 + baseScore * 0.3;
      
      return {
        ...pred,
        score: finalScore
      };
    });
    
    // ... 정렬 및 반환
  });
}
```

---

## 📈 **시간에 따른 성능 개선**

### **초기 (학습 데이터 0~100건)**
```
정확도: 60%
- 규칙 기반 시스템과 비슷
- 아직 학습 부족
```

### **중기 (학습 데이터 100~1000건)**
```
정확도: 80%
- 자주 쓰는 약어 패턴 학습됨
- "ch" → "찰스하이직" 연관성 이해
- 컨텍스트 구분 시작
```

### **장기 (학습 데이터 1000건+)**
```
정확도: 95%+
- 새로운 약어도 유사 패턴으로 추론
- "sh" 입력 → "샤또"로 추론 (ch와 유사 패턴)
- 사용자 습관 학습 (특정 거래처는 특정 패턴 선호)
```

---

## ⚡ **구현 단계**

### **Phase 1: 인프라 구축 (1주)**
1. Python 환경 설정
2. PyTorch 설치
3. FastAPI 서버 구축
4. TypeScript ↔ Python 통신 테스트

### **Phase 2: 모델 개발 (2주)**
1. 데이터 전처리 파이프라인
2. 임베딩 모델 구현
3. 랭킹 모델 구현
4. 초기 학습 (기존 거래 이력 활용)

### **Phase 3: 통합 (1주)**
1. resolveItemsWeighted 통합
2. 실시간 학습 API 연결
3. 모델 저장/로드 시스템

### **Phase 4: 최적화 (지속)**
1. 배치 학습 스케줄링
2. 모델 성능 모니터링
3. A/B 테스트
4. 하이퍼파라미터 튜닝

---

## 🎯 **PyTorch의 핵심 이점**

1. **자동 패턴 학습**
   - "ch", "bl", "lc" 패턴을 자동 인식
   - 새로운 약어도 유사도 기반 추론

2. **지속적 개선**
   - 사용자 선택마다 모델 업데이트
   - 학습 쌓일수록 똑똑해짐

3. **컨텍스트 이해**
   - "ch 샤르도네"와 "ch 까베" 구분
   - 품종 + 생산자 조합 학습

4. **전이 학습**
   - 한 거래처 학습이 다른 거래처에도 적용
   - 도메인 지식 누적

---

**이 방식으로 진행하시겠어요?** 🚀

강력하지만 구현 시간이 걸립니다:
- Phase 1-3: 약 4주
- 효과 체감: 학습 데이터 100건+ 부터
- 장기적으로 가장 강력한 시스템!
