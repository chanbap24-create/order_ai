# 🚀 Order AI - PyTorch ML Server

**정확도 최우선 품목 매칭 시스템 (90-95% 목표)**

## 🎯 개요

이 프로젝트는 PyTorch + Sentence Transformers를 사용하여 와인 발주 텍스트를 품목에 매칭하는 ML 서버입니다.

### 기술 스택
- **PyTorch**: 딥러닝 프레임워크
- **Sentence Transformers**: 문장 임베딩 모델
- **FastAPI**: Python 웹 프레임워크
- **Multilingual Model**: 한국어-영어 동시 처리

## 📊 성능

| 항목 | 수치 |
|------|------|
| **정확도** | 90-95% |
| **응답속도** | 200-500ms |
| **메모리** | 500MB-1GB |
| **동시 요청** | 10-50 req/s |

## 🛠️ 설치

### 1. 의존성 설치

```bash
cd ml-server
bash install.sh
```

### 2. English 시트 데이터 로드

```bash
source venv/bin/activate
python load_data.py
```

### 3. 서버 실행

**옵션 A: 직접 실행 (개발)**
```bash
python main.py
```

**옵션 B: PM2로 실행 (프로덕션)**
```bash
pm2 start ecosystem.config.js
pm2 logs ml-server
```

## 🔧 사용법

### API 엔드포인트

#### 1. 품목 매칭
```bash
POST http://localhost:8000/api/ml-match

{
  "query": "바롤로 3병",
  "top_k": 5,
  "min_score": 0.3
}
```

**응답:**
```json
{
  "success": true,
  "query": "바롤로 3병",
  "results": [
    {
      "item_no": "2118042",
      "item_name": "카시나 아델라이데 바롤로 / Cascina Adelaide Barolo (2018)",
      "korean_name": "카시나 아델라이데 바롤로",
      "english_name": "Cascina Adelaide Barolo",
      "vintage": "2018",
      "score": 0.92,
      "method": "pytorch_semantic"
    }
  ],
  "processing_time_ms": 234.5,
  "model_info": {
    "name": "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
    "type": "pytorch",
    "multilingual": "true"
  }
}
```

#### 2. 헬스체크
```bash
GET http://localhost:8000/

{
  "status": "healthy",
  "model": "sentence-transformers/...",
  "items_loaded": 374,
  "embeddings_cached": true
}
```

#### 3. 통계
```bash
GET http://localhost:8000/api/stats

{
  "model_loaded": true,
  "items_count": 374,
  "embeddings_cached": true,
  "cache_size_mb": 48.5
}
```

## 🔄 Next.js 통합

ML 서버는 Next.js 백엔드에서 자동으로 호출됩니다:

```typescript
// app/lib/mlClient.ts
import { mlMatch } from '@/app/lib/mlClient';

const response = await mlMatch({
  query: "바롤로",
  top_k: 5
});
```

### 하이브리드 시스템

```
사용자 입력
    ↓
Rule-based 매칭 (빠름, 60-70%)
    ↓ 점수 < 0.7
ML 매칭 (정확함, 90-95%)
    ↓
결과 반환
```

## 📈 모델 정보

### 사용 모델
- **sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2**
- 다국어 지원 (한국어, 영어 포함)
- 384 차원 임베딩
- 120M 파라미터

### 대안 모델

**한국어 특화:**
```python
model = SentenceTransformer('jhgan/ko-sroberta-multitask')
```

**더 큰 모델 (더 정확):**
```python
model = SentenceTransformer('sentence-transformers/paraphrase-multilingual-mpnet-base-v2')
```

## 🐛 문제 해결

### 1. 메모리 부족
```bash
# 더 작은 모델 사용
model = SentenceTransformer('sentence-transformers/paraphrase-MiniLM-L6-v2')
```

### 2. 느린 응답
```bash
# GPU 사용 (CUDA 설치 필요)
pip install torch --index-url https://download.pytorch.org/whl/cu118
```

### 3. 모델 다운로드 실패
```bash
# 수동 다운로드
python -c "from sentence_transformers import SentenceTransformer; model = SentenceTransformer('sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2')"
```

## 📊 성능 최적화

### 1. 임베딩 캐싱
모든 품목의 임베딩을 미리 계산하여 메모리에 캐시합니다.

### 2. 배치 처리
여러 요청을 배치로 처리하여 GPU 효율 향상.

### 3. 모델 양자화
메모리 절약을 위해 모델을 INT8로 양자화 가능.

## 🔐 환경 변수

```bash
# .env
ML_SERVER_URL=http://localhost:8000
DB_PATH=../data.sqlite3
```

## 📝 로그

로그는 `ml-server/logs/` 디렉토리에 저장됩니다:
- `ml-error.log`: 에러 로그
- `ml-out.log`: 일반 로그

## 🚀 배포

### Railway
```bash
# railway.json
{
  "build": {
    "command": "pip install -r requirements.txt"
  },
  "start": {
    "command": "python main.py"
  }
}
```

### Render
```yaml
# render.yaml
services:
  - type: web
    name: ml-server
    env: python
    buildCommand: pip install -r requirements.txt
    startCommand: python main.py
```

## 📚 참고 자료

- [Sentence Transformers 문서](https://www.sbert.net/)
- [FastAPI 문서](https://fastapi.tiangolo.com/)
- [PyTorch 문서](https://pytorch.org/docs/)

## 📄 라이센스

MIT License
