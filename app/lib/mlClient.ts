/**
 * PyTorch ML 서버와 통신하는 유틸리티
 */

const ML_SERVER_URL = process.env.ML_SERVER_URL || 'http://localhost:8000';

export interface MLMatchRequest {
  query: string;
  client_code?: string;
  top_k?: number;
  min_score?: number;
}

export interface MLMatchResult {
  item_no: string;
  item_name: string;
  korean_name?: string;
  english_name?: string;
  vintage?: string;
  score: number;
  method: string;
}

export interface MLMatchResponse {
  success: boolean;
  query: string;
  results: MLMatchResult[];
  processing_time_ms: number;
  model_info: {
    name: string;
    type: string;
    multilingual: string;
  };
}

/**
 * ML 서버로 품목 매칭 요청
 */
export async function mlMatch(request: MLMatchRequest): Promise<MLMatchResponse> {
  try {
    const response = await fetch(`${ML_SERVER_URL}/api/ml-match`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`ML 서버 응답 오류: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('[ML Match] 오류:', error);
    throw error;
  }
}

/**
 * ML 서버 헬스체크
 */
export async function mlHealthCheck(): Promise<boolean> {
  try {
    const response = await fetch(`${ML_SERVER_URL}/`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000), // 5초 타임아웃
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('[ML Server] 헬스체크 OK:', data);
      return data.status === 'healthy';
    }
    
    return false;
  } catch (error) {
    console.warn('[ML Server] 헬스체크 실패:', error);
    return false;
  }
}

/**
 * ML 서버 통계 조회
 */
export async function mlGetStats() {
  try {
    const response = await fetch(`${ML_SERVER_URL}/api/stats`);
    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch (error) {
    console.error('[ML Server] 통계 조회 실패:', error);
    return null;
  }
}
