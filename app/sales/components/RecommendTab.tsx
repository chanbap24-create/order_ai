'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface ClientOption {
  client_code: string;
  client_name: string;
  importance?: number;
  manager?: string;
  business_type?: string;
}

interface ScoredItem {
  item_no: string;
  item_name: string;
  country: string;
  region?: string;
  grape: string;
  wine_type?: string;
  price: number;
  stock: number;
  score: number;
  tags: string[];
  reason: string;
  buy_count?: number;
  last_order?: string;
}

interface RecommendResult {
  client: {
    code: string;
    name: string;
    importance: number;
    business_type: string;
    manager: string;
  };
  recommendations: ScoredItem[];
  summary: {
    total_items: number;
    avg_price: number;
    last_order_date: string | null;
    top_countries: string[];
    top_grapes: string[];
    top_types: string[];
  };
}

const TAG_COLORS: Record<string, string> = {
  '재주문': '#2196F3',
  '선호국가': '#9C27B0',
  '선호품종': '#E91E63',
  '선호타입': '#00897B',
  '적정가격': '#4CAF50',
  '프리미엄': '#FF9800',
  '인기': '#FF5722',
  '통관필요': '#795548',
  '봄': '#66BB6A', '여름': '#29B6F6', '가을': '#FF7043', '겨울': '#5C6BC0',
};

const IMPORTANCE_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'VIP', color: '#dc3545' },
  2: { label: '중요', color: '#fd7e14' },
  3: { label: '일반', color: '#6c757d' },
  4: { label: '간헐', color: '#adb5bd' },
  5: { label: '비활성', color: '#dee2e6' },
};

function fmt(n: number) {
  if (n >= 1e8) return (n / 1e8).toFixed(1) + '억';
  if (n >= 1e4) return Math.round(n / 1e4).toLocaleString() + '만';
  return n.toLocaleString();
}

function scoreColor(score: number): string {
  if (score >= 30) return '#c62828';
  if (score >= 20) return '#e65100';
  if (score >= 10) return '#f57f17';
  return '#757575';
}

export default function RecommendTab({ currentManager, isAdmin, preselectedClient }: { currentManager: string; isAdmin: boolean; preselectedClient?: ClientOption | null }) {
  const [clientSearch, setClientSearch] = useState(preselectedClient?.client_name || '');
  const [clientOptions, setClientOptions] = useState<ClientOption[]>([]);
  const [clientLoading, setClientLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(preselectedClient || null);
  const [filterManager, setFilterManager] = useState(isAdmin ? '' : currentManager);
  const [managers, setManagers] = useState<string[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [result, setResult] = useState<RecommendResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteResult, setQuoteResult] = useState<string | null>(null);
  const [showColSettings, setShowColSettings] = useState(false);

  const QUOTE_COL_OPTIONS: { key: string; label: string }[] = [
    { key: 'country', label: '국가' },
    { key: 'brand', label: '브랜드' },
    { key: 'region', label: '지역' },
    { key: 'grape_varieties', label: '포도품종' },
    { key: 'image_url', label: '이미지' },
    { key: 'vintage', label: '빈티지' },
    { key: 'product_name', label: '상품명' },
    { key: 'english_name', label: '영문명' },
    { key: 'supply_price', label: '공급가' },
    { key: 'retail_price', label: '판매가' },
    { key: 'discount_rate', label: '할인율' },
    { key: 'discounted_price', label: '할인가' },
    { key: 'quantity', label: '수량' },
    { key: 'normal_total', label: '정상합계' },
    { key: 'discount_total', label: '할인합계' },
    { key: 'tasting_note', label: '테이스팅노트' },
    { key: 'note', label: '비고' },
  ];

  const DEFAULT_REC_COLS = [
    'country','brand','region','grape_varieties',
    'image_url','vintage','product_name',
    'supply_price','retail_price','discount_rate','discounted_price',
    'tasting_note','note',
  ];

  const [quoteCols, setQuoteCols] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('recommend_quote_columns');
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return DEFAULT_REC_COLS;
  });

  useEffect(() => {
    try { localStorage.setItem('recommend_quote_columns', JSON.stringify(quoteCols)); } catch {}
  }, [quoteCols]);

  // 담당자 목록 — admin만
  useEffect(() => {
    if (!isAdmin) return;
    fetch('/api/sales/clients/managers')
      .then(r => r.json())
      .then(d => { if (d.managers) setManagers(d.managers); })
      .catch(() => {});
  }, [isAdmin]);

  // 거래처 검색
  const searchClients = useCallback(async (q: string) => {
    setClientLoading(true);
    try {
      const params = new URLSearchParams({ search: q, limit: '50', type: 'wine' });
      if (filterManager) params.set('manager', filterManager);
      const res = await fetch(`/api/sales/clients?${params}`);
      const json = await res.json();
      setClientOptions(json.clients || []);
      setShowDropdown(true);
    } catch {
      setClientOptions([]);
    } finally {
      setClientLoading(false);
    }
  }, [filterManager]);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (clientSearch.length >= 1) {
      searchTimer.current = setTimeout(() => searchClients(clientSearch), 300);
    } else {
      setClientOptions([]);
      setShowDropdown(false);
    }
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [clientSearch, searchClients]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // 토스트 자동 닫기
  useEffect(() => {
    if (!quoteResult) return;
    const t = setTimeout(() => setQuoteResult(null), 3000);
    return () => clearTimeout(t);
  }, [quoteResult]);

  // 추천 생성
  const generateRecommendations = async () => {
    if (!selectedClient) return;
    setLoading(true);
    setError('');
    setResult(null);
    setSelected(new Set());
    try {
      const res = await fetch('/api/sales/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_code: selectedClient.client_code }),
      });
      const json = await res.json();
      if (json.error) setError(json.error);
      else setResult(json);
    } catch {
      setError('추천 생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (itemNo: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(itemNo)) next.delete(itemNo);
      else next.add(itemNo);
      return next;
    });
  };

  const toggleAll = () => {
    if (!result) return;
    const all = result.recommendations;
    const allSelected = all.length > 0 && all.every(i => selected.has(i.item_no));
    setSelected(prev => {
      const next = new Set(prev);
      if (allSelected) all.forEach(i => next.delete(i.item_no));
      else all.forEach(i => next.add(i.item_no));
      return next;
    });
  };

  const getSelectedItems = (): ScoredItem[] => {
    if (!result) return [];
    return result.recommendations.filter(i => selected.has(i.item_no));
  };

  const createQuote = async (mode: 'download' | 'add') => {
    const items = getSelectedItems();
    if (items.length === 0) return;
    setQuoteLoading(true);
    setQuoteResult(null);
    try {
      const res = await fetch('/api/sales/recommend/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          client_code: selectedClient?.client_code,
          client_name: selectedClient?.client_name,
          clear_existing: mode === 'download',
        }),
      });
      const json = await res.json();
      if (json.error) { setQuoteResult(`오류: ${json.error}`); return; }

      if (mode === 'download') {
        const params = new URLSearchParams();
        params.set('columns', JSON.stringify(quoteCols));
        if (selectedClient?.client_name) params.set('client_name', selectedClient.client_name);
        window.location.href = `/api/quote/export?${params}`;
        setQuoteResult(`${json.added_count}개 와인 견적서 생성 완료`);
      } else {
        setQuoteResult(`${json.added_count}개 와인이 견적서에 추가되었습니다.`);
        setTimeout(() => { window.location.href = '/quote'; }, 1500);
      }
    } catch {
      setQuoteResult('견적서 생성에 실패했습니다.');
    } finally {
      setQuoteLoading(false);
    }
  };

  const selectedItems = getSelectedItems();
  const selectedTotal = selectedItems.reduce((sum, i) => sum + (i.price || 0), 0);
  const items = result?.recommendations || [];
  const allSelected = items.length > 0 && items.every(i => selected.has(i.item_no));

  return (
    <div style={{ paddingBottom: 100 }}>
      {/* ── 거래처 선택 ── */}
      <div style={{
        background: '#fff', borderRadius: 12, padding: '20px 16px',
        marginBottom: 16, boxShadow: '0 2px 8px rgba(90,21,21,0.03)',
        border: '1px solid rgba(90,21,21,0.06)',
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#2c1810', marginBottom: 12 }}>
          거래처 선택
        </div>

        {isAdmin && managers.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <select
              value={filterManager}
              onChange={e => { setFilterManager(e.target.value); setSelectedClient(null); setClientSearch(''); setResult(null); }}
              style={{
                padding: '8px 12px', borderRadius: 6, border: '1.5px solid rgba(90,21,21,0.08)',
                fontSize: 16, background: '#fff', color: filterManager ? '#2c1810' : '#999',
                outline: 'none', width: '100%', boxSizing: 'border-box',
              }}
            >
              <option value="">담당자 선택</option>
              {managers.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        )}

        <div ref={dropdownRef} style={{ position: 'relative' }}>
          <input
            type="text"
            placeholder="거래처명 또는 코드로 검색..."
            value={clientSearch}
            onChange={e => { setClientSearch(e.target.value); setSelectedClient(null); }}
            onFocus={() => { if (clientOptions.length > 0) setShowDropdown(true); }}
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 8,
              border: '1.5px solid rgba(90,21,21,0.08)', fontSize: 16, outline: 'none',
              boxSizing: 'border-box', background: selectedClient ? '#faf9f7' : '#fff',
            }}
          />
          {selectedClient && (
            <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 10,
                background: IMPORTANCE_LABELS[selectedClient.importance || 3]?.color || '#6c757d', color: '#fff',
              }}>{IMPORTANCE_LABELS[selectedClient.importance || 3]?.label || '일반'}</span>
              <button onClick={() => { setSelectedClient(null); setClientSearch(''); setResult(null); }} style={{
                background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#a8a098', padding: 0,
              }}>×</button>
            </div>
          )}
          {showDropdown && clientOptions.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0,
              background: '#fff', border: '1.5px solid rgba(90,21,21,0.08)',
              borderRadius: '0 0 8px 8px', maxHeight: 240, overflowY: 'auto',
              zIndex: 100, boxShadow: '0 4px 12px rgba(90,21,21,0.08)',
            }}>
              {clientOptions.map(c => (
                <div key={c.client_code} onClick={() => {
                  setSelectedClient(c); setClientSearch(c.client_name); setShowDropdown(false); setResult(null);
                }} style={{
                  padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid rgba(90,21,21,0.06)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#faf9f7')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: '#2c1810' }}>{c.client_name}</div>
                    <div style={{ fontSize: 11, color: '#a8a098' }}>
                      {c.client_code}{c.manager && ` · ${c.manager}`}{c.business_type && ` · ${c.business_type}`}
                    </div>
                  </div>
                  {c.importance && (
                    <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 8, background: IMPORTANCE_LABELS[c.importance]?.color || '#6c757d', color: '#fff' }}>
                      {IMPORTANCE_LABELS[c.importance]?.label}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
          {showDropdown && clientSearch && clientOptions.length === 0 && !clientLoading && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0,
              background: '#fff', border: '1.5px solid rgba(90,21,21,0.08)',
              borderRadius: '0 0 8px 8px', padding: '16px', textAlign: 'center',
              color: '#a8a098', fontSize: 13, zIndex: 100,
            }}>검색 결과가 없습니다</div>
          )}
        </div>

        {selectedClient && (
          <button onClick={generateRecommendations} disabled={loading} style={{
            width: '100%', marginTop: 12, padding: '12px', borderRadius: 8, border: 'none',
            background: loading ? '#ccc' : 'linear-gradient(135deg, #5A1515, #8B2252)',
            color: '#fff', fontSize: 14, fontWeight: 600,
            cursor: loading ? 'default' : 'pointer',
          }}>
            {loading ? '분석 중...' : `${selectedClient.client_name} AI 추천 생성`}
          </button>
        )}
      </div>

      {error && (
        <div style={{ background: '#fff5f5', color: '#c53030', padding: '12px 16px', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* ── 추천 결과 ── */}
      {result && (
        <>
          {/* 요약 카드 */}
          <div style={{
            background: 'linear-gradient(135deg, #5A1515, #8B2252)',
            borderRadius: 12, padding: '16px', marginBottom: 16, color: '#fff',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{result.client.name}</div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  {result.client.business_type || '업종 미설정'}
                  {result.client.manager && ` · ${result.client.manager}`}
                </div>
              </div>
              <div style={{ padding: '4px 10px', borderRadius: 12, background: 'rgba(255,255,255,0.2)', fontSize: 12 }}>
                {IMPORTANCE_LABELS[result.client.importance]?.label || '일반'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
              <div>
                <div style={{ opacity: 0.7 }}>구매 품목</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{result.summary.total_items}종</div>
              </div>
              <div>
                <div style={{ opacity: 0.7 }}>평균 구매가</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{fmt(result.summary.avg_price)}원</div>
              </div>
              <div>
                <div style={{ opacity: 0.7 }}>최근 주문</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{result.summary.last_order_date || '-'}</div>
              </div>
            </div>
            {(result.summary.top_countries.length > 0 || result.summary.top_grapes.length > 0 || (result.summary.top_types || []).length > 0) && (
              <div style={{ marginTop: 10, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {(result.summary.top_types || []).map(t => (
                  <span key={t} style={{ padding: '2px 8px', borderRadius: 10, background: 'rgba(0,137,123,0.3)', fontSize: 11 }}>{t}</span>
                ))}
                {result.summary.top_countries.map(c => (
                  <span key={c} style={{ padding: '2px 8px', borderRadius: 10, background: 'rgba(255,255,255,0.15)', fontSize: 11 }}>{c}</span>
                ))}
                {result.summary.top_grapes.map(g => (
                  <span key={g} style={{ padding: '2px 8px', borderRadius: 10, background: 'rgba(255,255,255,0.1)', fontSize: 11 }}>{g}</span>
                ))}
              </div>
            )}
          </div>

          {/* 리스트 헤더 */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: 8, padding: '0 4px',
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#2c1810' }}>
              AI 추천 {items.length}개
            </div>
            {items.length > 0 && (
              <button onClick={toggleAll} style={{
                fontSize: 12, color: '#5A1515', background: 'none',
                border: 'none', cursor: 'pointer', fontWeight: 500, textDecoration: 'underline',
              }}>
                {allSelected ? '전체 해제' : '전체 선택'}
              </button>
            )}
          </div>

          {/* 추천 리스트 */}
          {items.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '40px 20px', color: '#a8a098', fontSize: 13,
              background: '#fff', borderRadius: 12, border: '1px solid rgba(90,21,21,0.06)',
            }}>
              추천할 와인이 없습니다
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map((item, idx) => {
                const isSelected = selected.has(item.item_no);
                const sc = scoreColor(item.score);
                return (
                  <div key={item.item_no} onClick={() => toggleSelect(item.item_no)} style={{
                    background: '#fff', borderRadius: 10, padding: '14px',
                    border: isSelected ? '2px solid #5A1515' : '1px solid rgba(90,21,21,0.06)',
                    boxShadow: isSelected ? '0 0 0 1px rgba(90,21,21,0.1)' : '0 1px 2px rgba(90,21,21,0.03)',
                    cursor: 'pointer', transition: 'all 0.15s',
                    display: 'flex', gap: 12, alignItems: 'flex-start',
                  }}>
                    {/* 체크박스 */}
                    <div style={{
                      width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                      border: isSelected ? '2px solid #5A1515' : '2px solid rgba(90,21,21,0.12)',
                      background: isSelected ? '#5A1515' : '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      marginTop: 2,
                    }}>
                      {isSelected && (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>

                    {/* 내용 */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: sc, minWidth: 32 }}>
                          {item.score}점
                        </span>
                        <span style={{
                          fontSize: 14, fontWeight: 600, color: '#2c1810',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {item.item_name}
                        </span>
                      </div>
                      {/* 태그 */}
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 5 }}>
                        {item.tags.map(tag => (
                          <span key={tag} style={{
                            fontSize: 10, padding: '1px 6px', borderRadius: 8,
                            background: `${TAG_COLORS[tag] || '#999'}18`,
                            color: TAG_COLORS[tag] || '#999',
                            fontWeight: 600,
                          }}>{tag}</span>
                        ))}
                        {(item.country || item.grape) && (
                          <span style={{ fontSize: 10, color: '#8a8580', background: '#faf9f7', padding: '1px 6px', borderRadius: 4 }}>
                            {[item.country, item.region, item.grape].filter(Boolean).join(' · ')}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: '#8a8580' }}>
                        {item.reason}
                      </div>
                    </div>

                    {/* 가격/재고 */}
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#2c1810' }}>
                        {item.price ? fmt(item.price) + '원' : '-'}
                      </div>
                      <div style={{ fontSize: 11, color: '#a8a098', marginTop: 2 }}>
                        재고 {item.stock || 0}
                      </div>
                      {item.buy_count !== undefined && (
                        <div style={{ fontSize: 11, color: '#2196F3', marginTop: 1, fontWeight: 500 }}>
                          {item.buy_count}회 구매
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── 하단 액션 바 ── */}
      {result && selected.size > 0 && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: '#fff', borderTop: '1.5px solid rgba(90,21,21,0.08)',
          padding: '12px 16px', zIndex: 200,
          boxShadow: '0 -2px 10px rgba(90,21,21,0.05)',
        }}>
          <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#2c1810' }}>{selected.size}개 선택</div>
              <div style={{ fontSize: 12, color: '#8a8580' }}>예상 합계: {fmt(selectedTotal)}원</div>
            </div>
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowColSettings(v => !v)}
                style={{
                  width: 36, height: 36, borderRadius: 8, border: '1px solid #ddd',
                  background: showColSettings ? '#f5f0eb' : '#fff', color: '#5A1515',
                  fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                title="컬럼 설정"
              >⚙</button>
              {showColSettings && (
                <div style={{
                  position: 'absolute', bottom: 44, right: 0, background: '#fff',
                  border: '1px solid #e0e0e0', borderRadius: 10, padding: 12,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 300,
                  width: 220, maxHeight: 320, overflowY: 'auto',
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#5A1515', marginBottom: 8 }}>견적서 컬럼</div>
                  {QUOTE_COL_OPTIONS.map(col => (
                    <label key={col.key} style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0',
                      fontSize: 13, cursor: 'pointer', color: '#333',
                    }}>
                      <input
                        type="checkbox"
                        checked={quoteCols.includes(col.key)}
                        onChange={() => {
                          setQuoteCols(prev =>
                            prev.includes(col.key)
                              ? prev.filter(k => k !== col.key)
                              : [...prev, col.key]
                          );
                        }}
                        style={{ width: 14, height: 14 }}
                      />
                      {col.label}
                    </label>
                  ))}
                  <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => setQuoteCols(DEFAULT_REC_COLS)}
                      style={{
                        flex: 1, padding: '5px 0', borderRadius: 6, border: '1px solid #ddd',
                        background: '#fff', fontSize: 11, cursor: 'pointer', color: '#666',
                      }}
                    >초기화</button>
                    <button
                      onClick={() => setShowColSettings(false)}
                      style={{
                        flex: 1, padding: '5px 0', borderRadius: 6, border: 'none',
                        background: '#5A1515', color: '#fff', fontSize: 11, cursor: 'pointer',
                      }}
                    >닫기</button>
                  </div>
                </div>
              )}
            </div>
            <button onClick={() => createQuote('add')} disabled={quoteLoading} style={{
              padding: '10px 16px', borderRadius: 8, border: '1px solid #5A1515',
              background: '#fff', color: '#5A1515', fontSize: 13, fontWeight: 600,
              cursor: quoteLoading ? 'default' : 'pointer',
            }}>견적서에 추가</button>
            <button onClick={() => createQuote('download')} disabled={quoteLoading} style={{
              padding: '10px 16px', borderRadius: 8, border: 'none',
              background: quoteLoading ? '#ccc' : 'linear-gradient(135deg, #5A1515, #8B2252)',
              color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: quoteLoading ? 'default' : 'pointer',
            }}>{quoteLoading ? '처리 중...' : '견적서 생성'}</button>
          </div>
        </div>
      )}

      {/* ── 토스트 ── */}
      {quoteResult && (
        <div style={{
          position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)',
          background: quoteResult.startsWith('오류') ? '#c53030' : '#38a169',
          color: '#fff', padding: '12px 24px', borderRadius: 8,
          fontSize: 14, fontWeight: 500, zIndex: 300, boxShadow: '0 4px 12px rgba(90,21,21,0.1)',
        }}>{quoteResult}</div>
      )}

      {/* ── 초기 상태 ── */}
      {!result && !loading && !error && !selectedClient && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#a8a098', fontSize: 14 }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#a8a098" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 16 }}>
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
          <div style={{ fontWeight: 600, color: '#8a8580', marginBottom: 4 }}>AI 추천 엔진</div>
          <div>거래처를 검색하고 선택하면<br />맞춤 와인 추천을 생성합니다</div>
        </div>
      )}
    </div>
  );
}
