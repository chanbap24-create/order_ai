"""
PyTorch + Sentence Transformers 기반 품목 매칭 API
정확도 최우선 - 90-95% 목표
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import torch
from sentence_transformers import SentenceTransformer, util
import sqlite3
import os
from datetime import datetime

app = FastAPI(
    title="Order AI - ML Matching Server",
    description="PyTorch 기반 품목 매칭 서버 (정확도 최우선)",
    version="1.0.0"
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 프로덕션에서는 구체적인 도메인 지정
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 전역 변수
model = None
db_path = None
items_cache = None
embeddings_cache = None

# ==================== Pydantic Models ====================

class Item(BaseModel):
    item_no: str
    item_name: str
    korean_name: Optional[str] = None
    english_name: Optional[str] = None
    vintage: Optional[str] = None

class MatchRequest(BaseModel):
    query: str
    client_code: Optional[str] = None
    top_k: int = 5
    min_score: float = 0.3

class MatchResult(BaseModel):
    item_no: str
    item_name: str
    korean_name: Optional[str] = None
    english_name: Optional[str] = None
    vintage: Optional[str] = None
    score: float
    method: str = "pytorch_semantic"

class MatchResponse(BaseModel):
    success: bool
    query: str
    results: List[MatchResult]
    processing_time_ms: float
    model_info: Dict[str, str]

# ==================== 초기화 ====================

@app.on_event("startup")
async def startup_event():
    """서버 시작 시 모델 로드 및 초기화"""
    global model, db_path, items_cache, embeddings_cache
    
    print("🚀 ML Server 시작...")
    print("📦 Sentence Transformers 모델 로딩...")
    
    # 다국어 모델 로드 (한국어-영어 최적화)
    # Option 1: 다국어 최강 모델 (권장)
    model_name = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    
    # Option 2: 한국어 특화 모델 (한국어만 처리할 경우)
    # model_name = "jhgan/ko-sroberta-multitask"
    
    try:
        model = SentenceTransformer(model_name)
        print(f"✅ 모델 로드 완료: {model_name}")
    except Exception as e:
        print(f"❌ 모델 로드 실패: {e}")
        raise
    
    # DB 경로 설정
    db_path = os.path.join(os.path.dirname(__file__), "..", "data.sqlite3")
    if not os.path.exists(db_path):
        print(f"⚠️ DB 파일을 찾을 수 없습니다: {db_path}")
        print("   English 시트 데이터를 미리 로드합니다...")
        await preload_items()
    else:
        print(f"✅ DB 연결: {db_path}")
        await preload_items()

async def preload_items():
    """품목 데이터 미리 로드 및 임베딩 생성"""
    global items_cache, embeddings_cache
    
    print("📊 품목 데이터 로딩 중...")
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # client_item_stats에서 고유 품목 로드
        cursor.execute("""
            SELECT DISTINCT item_no, item_name 
            FROM client_item_stats 
            WHERE item_no IS NOT NULL AND item_name IS NOT NULL
            LIMIT 1000
        """)
        
        rows = cursor.fetchall()
        conn.close()
        
        if not rows:
            print("⚠️ 품목 데이터가 없습니다. English 시트 파싱이 필요합니다.")
            items_cache = []
            embeddings_cache = None
            return
        
        # 캐시 생성
        items_cache = [
            {"item_no": row[0], "item_name": row[1]}
            for row in rows
        ]
        
        print(f"📦 {len(items_cache)}개 품목 로드 완료")
        
        # 모든 품목명의 임베딩 미리 계산 (속도 최적화)
        print("🧠 품목 임베딩 생성 중...")
        item_names = [item["item_name"] for item in items_cache]
        embeddings_cache = model.encode(item_names, convert_to_tensor=True)
        print(f"✅ {len(item_names)}개 임베딩 생성 완료")
        
    except Exception as e:
        print(f"❌ 품목 로드 실패: {e}")
        items_cache = []
        embeddings_cache = None

# ==================== API Endpoints ====================

@app.get("/")
async def root():
    """헬스체크 엔드포인트"""
    return {
        "status": "healthy",
        "service": "Order AI ML Server",
        "model": "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
        "items_loaded": len(items_cache) if items_cache else 0,
        "embeddings_cached": embeddings_cache is not None
    }

@app.post("/api/ml-match", response_model=MatchResponse)
async def match_items(request: MatchRequest):
    """
    품목 매칭 API - PyTorch 의미 기반 매칭
    
    정확도 최우선 (90-95% 목표)
    """
    start_time = datetime.now()
    
    if not model:
        raise HTTPException(status_code=503, detail="모델이 로드되지 않았습니다")
    
    if not items_cache or embeddings_cache is None:
        raise HTTPException(status_code=503, detail="품목 데이터가 로드되지 않았습니다")
    
    try:
        # 쿼리 임베딩 생성
        query_embedding = model.encode(request.query, convert_to_tensor=True)
        
        # 코사인 유사도 계산 (GPU 가속)
        similarities = util.cos_sim(query_embedding, embeddings_cache)[0]
        
        # 상위 K개 결과 추출
        top_results = torch.topk(similarities, k=min(request.top_k * 2, len(items_cache)))
        
        # 결과 필터링 및 포맷팅
        results = []
        for idx, score in zip(top_results.indices, top_results.values):
            score_value = float(score)
            
            # 최소 점수 필터
            if score_value < request.min_score:
                continue
            
            item = items_cache[int(idx)]
            
            # 한글/영문 분리 (형식: "한글명 / English Name (2018)")
            item_name = item["item_name"]
            korean_name = None
            english_name = None
            vintage = None
            
            if " / " in item_name:
                parts = item_name.split(" / ")
                korean_name = parts[0].strip()
                english_part = parts[1].strip() if len(parts) > 1 else ""
                
                # 빈티지 추출
                if "(" in english_part and ")" in english_part:
                    vintage_start = english_part.rfind("(")
                    vintage = english_part[vintage_start+1:english_part.rfind(")")]
                    english_name = english_part[:vintage_start].strip()
                else:
                    english_name = english_part
            
            results.append(MatchResult(
                item_no=item["item_no"],
                item_name=item_name,
                korean_name=korean_name,
                english_name=english_name,
                vintage=vintage,
                score=score_value,
                method="pytorch_semantic"
            ))
            
            if len(results) >= request.top_k:
                break
        
        # 처리 시간 계산
        processing_time = (datetime.now() - start_time).total_seconds() * 1000
        
        return MatchResponse(
            success=True,
            query=request.query,
            results=results,
            processing_time_ms=processing_time,
            model_info={
                "name": "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
                "type": "pytorch",
                "multilingual": "true"
            }
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"매칭 실패: {str(e)}")

@app.get("/api/stats")
async def get_stats():
    """서버 통계 정보"""
    return {
        "model_loaded": model is not None,
        "items_count": len(items_cache) if items_cache else 0,
        "embeddings_cached": embeddings_cache is not None,
        "cache_size_mb": embeddings_cache.element_size() * embeddings_cache.nelement() / (1024**2) if embeddings_cache is not None else 0
    }

# ==================== 메인 실행 ====================

if __name__ == "__main__":
    import uvicorn
    
    print("=" * 60)
    print("🚀 Order AI ML Server - PyTorch + Sentence Transformers")
    print("=" * 60)
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )
