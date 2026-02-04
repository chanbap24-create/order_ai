'use client';

import { useState } from 'react';

export default function OrderInterpreterTest() {
  const [orderText, setOrderText] = useState('');
  const [clientCode, setClientCode] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const testCases = [
    {
      name: '기본 테스트',
      text: '안녕하세요\n메종 로쉐 벨렌 샤르도네 3병\n감사합니다',
    },
    {
      name: '약어 테스트',
      text: '스시소라\nch 2\nrf 3',
    },
    {
      name: '복잡한 발주',
      text: `라뜨리에드 오르조
리아타 샤르도네 4
차카나 누나 2
샤를루 4
리아타 3
찰스 하이직 2
메종 로쉐 벨렌 샤르도네 3
뫼르소 2
루이 미쉘 샤블리 1
오뜨꼬뜨드뉘 피노누아 3
나뚜라 까쇼 2
차카나 누나 말벡 2`,
    },
    {
      name: '인사말 많은 발주',
      text: '안녕하세요 과장님~~\n\n발주 부탁드릴게요!!\n\nch 5\nrf 2\n\n감사합니다^^',
    },
  ];

  const handleSubmit = async () => {
    if (!orderText.trim()) {
      setError('발주 텍스트를 입력해주세요');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('/api/interpret-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          raw_order_text: orderText,
          client_code: clientCode || undefined,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'API 호출 실패');
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      setLoading(false);
    }
  };

  const loadTestCase = (text: string) => {
    setOrderText(text);
    setResult(null);
    setError('');
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          발주 해석 엔진 테스트
        </h1>
        <p className="text-gray-600 mb-8">
          카카오톡 자유형식 발주를 구조화된 JSON으로 변환합니다
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 입력 영역 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">입력</h2>
            
            {/* 테스트 케이스 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                테스트 케이스 선택:
              </label>
              <div className="flex flex-wrap gap-2">
                {testCases.map((tc, idx) => (
                  <button
                    key={idx}
                    onClick={() => loadTestCase(tc.text)}
                    className="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm"
                  >
                    {tc.name}
                  </button>
                ))}
              </div>
            </div>

            {/* 거래처 코드 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                거래처 코드 (선택):
              </label>
              <input
                type="text"
                value={clientCode}
                onChange={(e) => setClientCode(e.target.value)}
                placeholder="예: 31833"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>

            {/* 발주 텍스트 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                발주 텍스트:
              </label>
              <textarea
                value={orderText}
                onChange={(e) => setOrderText(e.target.value)}
                placeholder="카카오톡 발주 내용을 입력하세요..."
                className="w-full h-64 px-3 py-2 border border-gray-300 rounded-md font-mono text-sm"
              />
            </div>

            {/* 실행 버튼 */}
            <button
              onClick={handleSubmit}
              disabled={loading}
              className={`w-full py-3 rounded-md text-white font-semibold ${
                loading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {loading ? '해석 중...' : '발주 해석 실행'}
            </button>

            {/* 에러 메시지 */}
            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                {error}
              </div>
            )}
          </div>

          {/* 결과 영역 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">결과</h2>
            
            {!result && !loading && (
              <div className="text-gray-500 text-center py-12">
                발주 텍스트를 입력하고 실행 버튼을 눌러주세요
              </div>
            )}

            {loading && (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">해석 중...</p>
              </div>
            )}

            {result && result.success && (
              <div className="space-y-4">
                {/* 메타 정보 */}
                <div className="bg-gray-50 p-4 rounded-md">
                  <h3 className="font-semibold mb-2">처리 정보</h3>
                  <div className="text-sm space-y-1">
                    <p>처리 시간: {result.meta.processing_time_ms}ms</p>
                    <p>품목 수: {result.meta.items_count}개</p>
                    <p>자동 확정: {result.meta.auto_confirmed_count}개</p>
                    <p className={`font-semibold ${result.meta.needs_review ? 'text-yellow-600' : 'text-green-600'}`}>
                      {result.meta.needs_review ? '⚠️ 확인 필요' : '✅ 자동 확정 가능'}
                    </p>
                  </div>
                </div>

                {/* 거래처 */}
                {result.data.client_name && (
                  <div className="bg-blue-50 p-4 rounded-md">
                    <h3 className="font-semibold mb-2">거래처</h3>
                    <p className="text-lg">{result.data.client_name}</p>
                  </div>
                )}

                {/* 품목 리스트 */}
                <div>
                  <h3 className="font-semibold mb-3">품목 상세</h3>
                  <div className="space-y-3">
                    {result.data.items.map((item: any, idx: number) => (
                      <div
                        key={idx}
                        className={`border rounded-lg p-4 ${
                          item.auto_confirm
                            ? 'border-green-300 bg-green-50'
                            : 'border-yellow-300 bg-yellow-50'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="font-semibold">
                            {idx + 1}. {item.raw} (수량: {item.qty})
                          </div>
                          <div className="flex gap-2">
                            <span
                              className={`px-2 py-1 rounded text-xs font-semibold ${
                                item.auto_confirm
                                  ? 'bg-green-200 text-green-800'
                                  : 'bg-yellow-200 text-yellow-800'
                              }`}
                            >
                              {item.auto_confirm ? '자동확정' : '확인필요'}
                            </span>
                            <span className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs font-semibold">
                              {Math.round(item.confidence * 100)}%
                            </span>
                          </div>
                        </div>
                        
                        {item.matched_sku && (
                          <div className="text-sm mb-1">
                            <span className="font-medium">SKU:</span> {item.matched_sku}
                          </div>
                        )}
                        
                        {item.matched_name && (
                          <div className="text-sm mb-1">
                            <span className="font-medium">품목명:</span> {item.matched_name}
                          </div>
                        )}
                        
                        <div className="text-sm text-gray-600 mt-2">
                          <span className="font-medium">이유:</span> {item.reason}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 노트 */}
                {result.data.notes && result.data.notes.length > 0 && (
                  <div className="bg-gray-50 p-4 rounded-md">
                    <h3 className="font-semibold mb-2">참고사항</h3>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      {result.data.notes.map((note: string, idx: number) => (
                        <li key={idx}>{note}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* JSON 원문 */}
                <details className="bg-gray-50 p-4 rounded-md">
                  <summary className="font-semibold cursor-pointer">
                    JSON 원문 보기
                  </summary>
                  <pre className="mt-2 text-xs overflow-x-auto">
                    {JSON.stringify(result.data, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
