'use client';

import { useState } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

export default function TestGPTParserPage() {
  const [message, setMessage] = useState(`스시소라
샤또마르고 2병
루이로드레 3병
돔페리뇽 1병`);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleParse = async () => {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/parse-order-gpt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          type: 'wine',
          force_resolve: false,
        }),
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({ success: false, error: String(error) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 'var(--space-6)', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 className="heading-xl" style={{ marginBottom: 'var(--space-6)' }}>
        GPT 파서 테스트
      </h1>

      <Card>
        <div style={{ padding: 'var(--space-4)' }}>
          <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontWeight: 600 }}>
            발주 메시지 입력:
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="발주 메시지를 입력하세요..."
            style={{
              width: '100%',
              minHeight: '200px',
              padding: 'var(--space-3)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              fontFamily: 'inherit',
              fontSize: 'var(--text-base)',
              resize: 'vertical',
            }}
          />

          <div style={{ marginTop: 'var(--space-4)' }}>
            <Button onClick={handleParse} disabled={loading}>
              {loading ? '파싱 중...' : 'GPT 파싱 실행'}
            </Button>
          </div>
        </div>
      </Card>

      {result && (
        <Card style={{ marginTop: 'var(--space-6)' }}>
          <div style={{ padding: 'var(--space-4)' }}>
            <h2 className="heading-lg" style={{ marginBottom: 'var(--space-4)' }}>
              파싱 결과
            </h2>

            {result.success ? (
              <div>
                {/* 거래처 정보 */}
                {result.client && (
                  <div style={{ marginBottom: 'var(--space-6)' }}>
                    <h3 className="heading-md" style={{ marginBottom: 'var(--space-2)' }}>
                      거래처
                    </h3>
                    <div style={{ 
                      padding: 'var(--space-3)', 
                      background: result.client.status === 'resolved' ? '#d4edda' : '#fff3cd',
                      borderRadius: 'var(--radius-md)',
                    }}>
                      {result.client.status === 'resolved' ? (
                        <div>
                          <strong>{result.client.client_name}</strong> ({result.client.client_code})
                          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-light)', marginTop: 'var(--space-1)' }}>
                            매칭 방법: {result.client.method}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <strong>거래처 미확정</strong>
                          <div style={{ marginTop: 'var(--space-2)' }}>
                            후보: {result.client.candidates?.map((c: any) => 
                              `${c.client_name} (${(c.score * 100).toFixed(0)}%)`
                            ).join(', ')}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 품목 정보 */}
                {result.items && result.items.length > 0 && (
                  <div style={{ marginBottom: 'var(--space-6)' }}>
                    <h3 className="heading-md" style={{ marginBottom: 'var(--space-2)' }}>
                      품목 ({result.items.length}개)
                    </h3>
                    
                    {result.items.map((item: any, idx: number) => (
                      <div 
                        key={idx}
                        style={{ 
                          padding: 'var(--space-3)', 
                          background: item.resolved ? '#d4edda' : '#fff3cd',
                          borderRadius: 'var(--radius-md)',
                          marginBottom: 'var(--space-2)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                          <div style={{ flex: 1 }}>
                            <strong>{item.name}</strong> x {item.qty}병
                            {item.resolved && (
                              <div style={{ marginTop: 'var(--space-1)', fontSize: 'var(--text-sm)' }}>
                                ✅ {item.item_no}: {item.item_name}
                                {item.method && (
                                  <span style={{ marginLeft: 'var(--space-2)', color: 'var(--color-text-light)' }}>
                                    ({item.method})
                                  </span>
                                )}
                              </div>
                            )}
                            {item.gpt_info && (
                              <div style={{ marginTop: 'var(--space-1)', fontSize: 'var(--text-sm)', color: 'var(--color-text-light)' }}>
                                🤖 GPT: {item.gpt_info.confidence} confidence
                                {item.gpt_info.matched_item_no && ` - ${item.gpt_info.matched_item_no}`}
                              </div>
                            )}
                          </div>
                        </div>

                        {!item.resolved && item.suggestions && item.suggestions.length > 0 && (
                          <div style={{ marginTop: 'var(--space-2)', paddingTop: 'var(--space-2)', borderTop: '1px solid #ccc' }}>
                            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
                              추천 후보:
                            </div>
                            {item.suggestions.map((sug: any, sugIdx: number) => (
                              <div key={sugIdx} style={{ fontSize: 'var(--text-sm)', marginLeft: 'var(--space-3)' }}>
                                {sugIdx + 1}. {sug.item_no}: {sug.item_name}
                                <span style={{ marginLeft: 'var(--space-2)', color: 'var(--color-text-light)' }}>
                                  ({((sug.score || 0) * 100).toFixed(0)}%)
                                  {sug.source === 'gpt' && ' 🤖'}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* 직원 메시지 */}
                {result.staff_message && (
                  <div style={{ marginBottom: 'var(--space-6)' }}>
                    <h3 className="heading-md" style={{ marginBottom: 'var(--space-2)' }}>
                      직원 메시지
                    </h3>
                    <pre style={{ 
                      padding: 'var(--space-3)', 
                      background: '#f8f9fa',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--text-sm)',
                      whiteSpace: 'pre-wrap',
                      overflowX: 'auto',
                    }}>
                      {result.staff_message}
                    </pre>
                  </div>
                )}

                {/* 디버그 정보 */}
                {result.debug && (
                  <details style={{ marginTop: 'var(--space-4)' }}>
                    <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
                      디버그 정보 (펼치기)
                    </summary>
                    <pre style={{ 
                      marginTop: 'var(--space-2)',
                      padding: 'var(--space-3)', 
                      background: '#f8f9fa',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--text-xs)',
                      whiteSpace: 'pre-wrap',
                      overflowX: 'auto',
                    }}>
                      {JSON.stringify(result.debug, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ) : (
              <div style={{ color: '#dc3545' }}>
                <strong>오류:</strong> {result.error}
              </div>
            )}

            {/* 전체 결과 */}
            <details style={{ marginTop: 'var(--space-4)' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
                전체 응답 (JSON)
              </summary>
              <pre style={{ 
                marginTop: 'var(--space-2)',
                padding: 'var(--space-3)', 
                background: '#f8f9fa',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--text-xs)',
                whiteSpace: 'pre-wrap',
                overflowX: 'auto',
                maxHeight: '400px',
              }}>
                {JSON.stringify(result, null, 2)}
              </pre>
            </details>
          </div>
        </Card>
      )}
    </div>
  );
}
