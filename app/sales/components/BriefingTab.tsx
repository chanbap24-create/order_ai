'use client';

import { useState, useEffect, useCallback } from 'react';

interface Meeting {
  id: number;
  client_code: string;
  meeting_date: string;
  meeting_time: string | null;
  meeting_type: string;
  status: string;
  purpose: string | null;
  ai_briefing: any;
  client_name: string;
  client_importance: number;
  client_business_type: string;
  client_manager: string;
}

interface PurchasedItem {
  item_no: string;
  item_name: string;
  buy_count: number;
  last_date: string;
  avg_unit_price: number;
  supply_price: number;
  grade: string;
  country?: string;
  wine_type?: string;
}

interface BriefingData {
  generated_at: string;
  client_summary: {
    total_purchases: number;
    avg_price: number;
    top_countries: string[];
    top_grapes: string[];
    top_types: string[];
    last_order_date: string | null;
    trend: string;
    yearly_revenue?: number;
    importance?: number | null;
  };
  avg_discount_rate?: number | null;
  purchased_items?: PurchasedItem[];
  recommendations: {
    item_no: string;
    item_name: string;
    score: number;
    tags: string[];
    reason: string;
    price: number;
    stock: number;
    country?: string;
    region?: string;
    grape?: string;
    wine_type?: string;
  }[];
  recent_orders: {
    item_name: string;
    ship_date: string;
    quantity: number;
  }[];
}

const MEETING_TYPES: Record<string, { label: string; color: string }> = {
  visit: { label: '방문', color: '#2196F3' },
  call: { label: '전화', color: '#4CAF50' },
  tasting: { label: '시음', color: '#9C27B0' },
  delivery: { label: '납품', color: '#FF9800' },
};

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  planned: { label: '예정', color: '#1976D2', bg: '#E3F2FD' },
  confirmed: { label: '확정', color: '#E65100', bg: '#FFF3E0' },
  completed: { label: '완료', color: '#2E7D32', bg: '#E8F5E9' },
  cancelled: { label: '취소', color: '#757575', bg: '#F5F5F5' },
};

const TAG_COLORS: Record<string, string> = {
  '재주문': '#2196F3', '선호국가': '#9C27B0', '선호품종': '#E91E63',
  '선호타입': '#00897B', '적정가격': '#4CAF50', '프리미엄': '#FF9800',
  '인기': '#FF5722', '통관필요': '#795548',
  '봄': '#66BB6A', '여름': '#29B6F6', '가을': '#FF7043', '겨울': '#5C6BC0',
};

const IMPORTANCE_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'VIP', color: '#b71c1c' },
  2: { label: '중요', color: '#e65100' },
  3: { label: '보통', color: '#1565c0' },
  4: { label: '소규모', color: '#616161' },
  5: { label: '일반', color: '#9e9e9e' },
};

function fmt(n: number) {
  if (n >= 1e8) return (n / 1e8).toFixed(1) + '억';
  if (n >= 1e4) return Math.round(n / 1e4).toLocaleString() + '만';
  return n.toLocaleString();
}

interface ShipClient {
  client_code: string;
  client_name: string;
  business_type: string;
  supply_amount: number;
  tax_amount: number;
  total_amount: number;
  items: { item_no: string; item_name: string; quantity: number; unit_price: number; total_amount: number }[];
}

export default function BriefingTab({ currentManager, isAdmin }: { currentManager: string; isAdmin: boolean }) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(false);
  const [generatingId, setGeneratingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [toast, setToast] = useState('');
  const [quoteLoadingId, setQuoteLoadingId] = useState<number | null>(null);
  const [showColSettingsId, setShowColSettingsId] = useState<number | null>(null);
  const [todayShipments, setTodayShipments] = useState<{ clients: ShipClient[]; totals: { supply: number; tax: number; total: number }; count: number } | null>(null);
  const [expandedShipClient, setExpandedShipClient] = useState<string | null>(null);

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

  const DEFAULT_BRIEFING_COLS = [
    'country','brand','region','grape_varieties',
    'image_url','vintage','product_name',
    'supply_price','retail_price','discount_rate','discounted_price',
    'tasting_note','note',
  ];

  const [quoteCols, setQuoteCols] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('briefing_quote_columns');
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return DEFAULT_BRIEFING_COLS;
  });

  useEffect(() => {
    try { localStorage.setItem('briefing_quote_columns', JSON.stringify(quoteCols)); } catch {}
  }, [quoteCols]);

  const createQuoteFromBriefing = async (meeting: Meeting, briefing: BriefingData) => {
    if (briefing.recommendations.length === 0) return;
    setQuoteLoadingId(meeting.id);
    try {
      const items = briefing.recommendations.slice(0, 5);
      const res = await fetch('/api/sales/recommend/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          client_code: meeting.client_code,
          client_name: meeting.client_name,
          clear_existing: true,
        }),
      });
      const json = await res.json();
      if (json.error) { setToast('오류: ' + json.error); return; }
      const params = new URLSearchParams();
      params.set('columns', JSON.stringify(quoteCols));
      if (meeting.client_name) params.set('client_name', meeting.client_name);
      window.location.href = `/api/quote/export?${params}`;
      setToast(`${json.added_count}개 와인 견적서 생성 완료`);
    } catch {
      setToast('견적서 생성에 실패했습니다.');
    } finally {
      setQuoteLoadingId(null);
    }
  };

  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const todayStr = kstNow.toISOString().slice(0, 10);
  const todayLabel = `${kstNow.getUTCMonth() + 1}월 ${kstNow.getUTCDate()}일`;

  // 오늘 미팅 로드
  const loadToday = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ date_from: todayStr, date_to: todayStr });
      if (!isAdmin) params.set('manager', currentManager);
      const res = await fetch(`/api/sales/meetings?${params}`);
      const json = await res.json();
      setMeetings(json.meetings || []);
    } catch {
      setMeetings([]);
    } finally {
      setLoading(false);
    }
  }, [todayStr, isAdmin, currentManager]);

  useEffect(() => { loadToday(); }, [loadToday]);

  // 금일 출고 현황 로드
  useEffect(() => {
    if (!currentManager) return;
    (async () => {
      try {
        const params = new URLSearchParams();
        if (!isAdmin) params.set('manager', currentManager);
        const res = await fetch(`/api/sales/shipments/today?${params}`);
        const json = await res.json();
        // wine + glass 합산
        const w = json.wine || { clients: [], totals: { supply: 0, tax: 0, total: 0 }, count: 0 };
        const g = json.glass || { clients: [], totals: { supply: 0, tax: 0, total: 0 }, count: 0 };
        setTodayShipments({
          clients: [...w.clients, ...g.clients],
          totals: { supply: w.totals.supply + g.totals.supply, tax: w.totals.tax + g.totals.tax, total: w.totals.total + g.totals.total },
          count: w.count + g.count,
        });
      } catch (e) {
        console.error('[shipments/today] error', e);
      }
    })();
  }, [isAdmin, currentManager]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // 브리핑 생성
  const generateBriefing = async (meeting: Meeting) => {
    setGeneratingId(meeting.id);
    try {
      const res = await fetch('/api/sales/meetings/briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meeting_id: meeting.id, client_code: meeting.client_code }),
      });
      const json = await res.json();
      if (json.error) { setToast('브리핑 생성 실패'); return; }
      // 로컬 업데이트
      setMeetings(prev => prev.map(m =>
        m.id === meeting.id ? { ...m, ai_briefing: json.briefing } : m
      ));
      setExpandedId(meeting.id);
      setToast('브리핑이 생성되었습니다.');
    } catch {
      setToast('브리핑 생성에 실패했습니다.');
    } finally {
      setGeneratingId(null);
    }
  };

  // 전체 브리핑 일괄 생성
  const generateAll = async () => {
    const pending = meetings.filter(m => !m.ai_briefing && m.status !== 'cancelled');
    for (const m of pending) {
      await generateBriefing(m);
    }
  };

  const hasBriefing = (m: Meeting) => !!m.ai_briefing;
  const pendingCount = meetings.filter(m => !m.ai_briefing && m.status !== 'cancelled').length;
  const completedCount = meetings.filter(m => !!m.ai_briefing).length;

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '60px', color: '#a8a098' }}>로딩 중...</div>;
  }

  if (meetings.length === 0 && !todayShipments) {
    return (
      <div style={{
        textAlign: 'center', padding: '60px 20px', color: '#a8a098', fontSize: 14,
      }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ddd" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 16 }}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8" />
        </svg>
        <div style={{ fontWeight: 600, color: '#8a8580', marginBottom: 4 }}>오늘 미팅 없음</div>
        <div>{todayLabel} 예정된 미팅이 없습니다</div>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* 헤더 */}
      {meetings.length > 0 && <div style={{
        background: 'linear-gradient(135deg, #1a237e, #4a148c)',
        borderRadius: 12, padding: 16, color: '#fff', marginBottom: 16,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{todayLabel} 브리핑</div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>오늘 미팅 {meetings.length}건</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{completedCount}</div>
              <div style={{ fontSize: 10, opacity: 0.7 }}>준비됨</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{pendingCount}</div>
              <div style={{ fontSize: 10, opacity: 0.7 }}>미준비</div>
            </div>
          </div>
        </div>

        {pendingCount > 0 && (
          <button onClick={generateAll} disabled={generatingId !== null} style={{
            width: '100%', padding: '10px', borderRadius: 8, border: 'none',
            background: generatingId !== null ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.3)',
            color: '#fff', fontSize: 13, fontWeight: 600,
            cursor: generatingId !== null ? 'default' : 'pointer',
          }}>
            {generatingId !== null ? '생성 중...' : `미준비 ${pendingCount}건 일괄 브리핑 생성`}
          </button>
        )}
      </div>}

      {/* 금일 출고 현황 */}
      {todayShipments && (
        <div style={{
          background: '#fff', borderRadius: 12, border: '1px solid rgba(90,21,21,0.06)',
          boxShadow: '0 1px 3px rgba(90,21,21,0.03)', marginBottom: 16, overflow: 'hidden',
        }}>
          <div style={{
            padding: '12px 14px', borderBottom: '1px solid rgba(90,21,21,0.06)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#2c1810' }}>
              금일 출고 현황 ({todayShipments.count}건)
            </span>
          </div>

          {/* 거래처 목록 */}
          {todayShipments.clients.length === 0 ? (
            <div style={{ padding: '20px 14px', textAlign: 'center', color: '#a8a098', fontSize: 13 }}>
              금일 출고 건이 없습니다
            </div>
          ) : <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#fafaf8' }}>
                  <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#8a8580', whiteSpace: 'nowrap' }}>거래처</th>
                  <th style={{ padding: '8px 6px', textAlign: 'left', fontWeight: 600, color: '#8a8580', whiteSpace: 'nowrap' }}>업종</th>
                  <th style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 600, color: '#8a8580', whiteSpace: 'nowrap' }}>공급금액</th>
                  <th style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 600, color: '#8a8580', whiteSpace: 'nowrap' }}>부가세</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: '#8a8580', whiteSpace: 'nowrap' }}>합계</th>
                </tr>
              </thead>
                {todayShipments.clients.map(c => {
                  const isExp = expandedShipClient === (c.client_code || c.client_name);
                  return (
                    <tbody key={c.client_code || c.client_name}>
                      <tr
                        onClick={() => setExpandedShipClient(isExp ? null : (c.client_code || c.client_name))}
                        style={{ cursor: 'pointer', borderBottom: isExp ? 'none' : '1px solid rgba(90,21,21,0.04)' }}
                      >
                        <td style={{ padding: '8px 10px', fontWeight: 600, color: '#2c1810', whiteSpace: 'nowrap', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {isExp ? '▾ ' : '▸ '}{c.client_name}
                        </td>
                        <td style={{ padding: '8px 6px', color: '#a8a098', whiteSpace: 'nowrap' }}>{c.business_type || '-'}</td>
                        <td style={{ padding: '8px 6px', textAlign: 'right', color: '#333', whiteSpace: 'nowrap' }}>{fmt(c.supply_amount)}</td>
                        <td style={{ padding: '8px 6px', textAlign: 'right', color: '#999', whiteSpace: 'nowrap' }}>{fmt(c.tax_amount)}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#2c1810', whiteSpace: 'nowrap' }}>{fmt(c.total_amount)}</td>
                      </tr>
                      {isExp && (
                        <>
                          <tr style={{ background: '#f8f6f4' }}>
                            <td style={{ padding: '4px 10px 4px 28px', fontSize: 10, fontWeight: 600, color: '#a8a098' }}>품목</td>
                            <td style={{ padding: '4px 6px', fontSize: 10, fontWeight: 600, color: '#a8a098' }}>품명</td>
                            <td style={{ padding: '4px 6px', fontSize: 10, fontWeight: 600, color: '#a8a098', textAlign: 'right' }}>수량</td>
                            <td style={{ padding: '4px 6px', fontSize: 10, fontWeight: 600, color: '#a8a098', textAlign: 'right' }}>단가</td>
                            <td style={{ padding: '4px 10px', fontSize: 10, fontWeight: 600, color: '#a8a098', textAlign: 'right' }}>금액</td>
                          </tr>
                          {c.items.map((it, idx) => (
                            <tr key={idx} style={{ background: '#f8f6f4', borderBottom: idx === c.items.length - 1 ? 'none' : '1px solid rgba(90,21,21,0.03)' }}>
                              <td style={{ padding: '4px 10px 4px 28px', fontSize: 11, color: '#666' }}>{it.item_no}</td>
                              <td style={{ padding: '4px 6px', fontSize: 11, color: '#333', whiteSpace: 'nowrap', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.item_name}</td>
                              <td style={{ padding: '4px 6px', fontSize: 11, color: '#333', textAlign: 'right' }}>{it.quantity}</td>
                              <td style={{ padding: '4px 6px', fontSize: 11, color: '#999', textAlign: 'right' }}>{fmt(it.unit_price)}</td>
                              <td style={{ padding: '4px 10px', fontSize: 11, color: '#333', textAlign: 'right', fontWeight: 600 }}>{fmt(it.total_amount)}</td>
                            </tr>
                          ))}
                          <tr style={{ background: '#f8f6f4', borderBottom: '1px solid rgba(90,21,21,0.06)' }}>
                            <td colSpan={4} style={{ padding: '6px 10px', fontSize: 11, fontWeight: 600, color: '#8a8580', textAlign: 'right' }}>소계</td>
                            <td style={{ padding: '6px 10px', fontSize: 11, fontWeight: 700, color: '#2c1810', textAlign: 'right' }}>{fmt(c.total_amount)}</td>
                          </tr>
                        </>
                      )}
                    </tbody>
                  );
                })}
              <tfoot>
                <tr style={{ borderTop: '2px solid rgba(90,21,21,0.1)' }}>
                  <td colSpan={2} style={{ padding: '10px', fontSize: 12, fontWeight: 700, color: '#2c1810' }}>합계</td>
                  <td style={{ padding: '10px 6px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#333' }}>{fmt(todayShipments.totals.supply)}</td>
                  <td style={{ padding: '10px 6px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: '#999' }}>{fmt(todayShipments.totals.tax)}</td>
                  <td style={{ padding: '10px', textAlign: 'right', fontSize: 13, fontWeight: 700, color: '#1a237e' }}>{fmt(todayShipments.totals.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>}
        </div>
      )}

      {/* 미팅 목록 */}
      {meetings.length > 0 && <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {meetings.map(m => {
          const mt = MEETING_TYPES[m.meeting_type] || MEETING_TYPES.visit;
          const st = STATUS_MAP[m.status] || STATUS_MAP.planned;
          const briefing = m.ai_briefing as BriefingData | null;
          const isExpanded = expandedId === m.id;

          return (
            <div key={m.id} style={{
              background: '#fff', borderRadius: 12,
              border: hasBriefing(m) ? '1px solid #c8e6c9' : '1px solid rgba(90,21,21,0.06)',
              boxShadow: '0 1px 3px rgba(90,21,21,0.03)',
              overflow: 'hidden',
            }}>
              {/* 미팅 헤더 */}
              <div onClick={() => setExpandedId(isExpanded ? null : m.id)} style={{
                padding: '12px 14px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                {/* 시간 */}
                <div style={{
                  width: 44, flexShrink: 0, textAlign: 'center',
                  fontSize: 13, fontWeight: 700, color: '#5A1515',
                }}>
                  {m.meeting_time || '--:--'}
                </div>

                {/* 정보 */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#2c1810', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {m.client_name}
                    {m.client_importance && IMPORTANCE_LABELS[m.client_importance] && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 6,
                        background: `${IMPORTANCE_LABELS[m.client_importance].color}18`,
                        color: IMPORTANCE_LABELS[m.client_importance].color,
                      }}>
                        {IMPORTANCE_LABELS[m.client_importance].label}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <span style={{
                      fontSize: 10, padding: '1px 6px', borderRadius: 8,
                      background: `${mt.color}18`, color: mt.color, fontWeight: 600,
                    }}>{mt.label}</span>
                    <span style={{
                      fontSize: 10, padding: '1px 6px', borderRadius: 8,
                      background: st.bg, color: st.color, fontWeight: 600,
                    }}>{st.label}</span>
                    {m.purpose && (
                      <span style={{ fontSize: 11, color: '#a8a098' }}>{m.purpose}</span>
                    )}
                  </div>
                </div>

                {/* 브리핑 상태 */}
                <div style={{ flexShrink: 0 }}>
                  {hasBriefing(m) ? (
                    <div style={{
                      width: 28, height: 28, borderRadius: 14, background: '#e8f5e9',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <svg width="14" height="14" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="#2E7D32" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  ) : (
                    <button onClick={(e) => { e.stopPropagation(); generateBriefing(m); }} disabled={generatingId === m.id} style={{
                      padding: '5px 10px', borderRadius: 6, border: 'none',
                      background: generatingId === m.id ? '#eee' : '#1a237e',
                      color: generatingId === m.id ? '#999' : '#fff',
                      fontSize: 11, fontWeight: 600, cursor: generatingId === m.id ? 'default' : 'pointer',
                    }}>
                      {generatingId === m.id ? '...' : '생성'}
                    </button>
                  )}
                </div>
              </div>

              {/* 확장: 브리핑 요약 */}
              {isExpanded && briefing && (
                <div style={{
                  borderTop: '1px solid rgba(90,21,21,0.06)', padding: '14px',
                  background: '#fafaf8',
                }}>
                  {/* 거래처 등급 & 올해 매출 */}
                  <div style={{
                    display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap',
                  }}>
                    {briefing.client_summary.importance && IMPORTANCE_LABELS[briefing.client_summary.importance] && (
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                        background: `${IMPORTANCE_LABELS[briefing.client_summary.importance].color}18`,
                        color: IMPORTANCE_LABELS[briefing.client_summary.importance].color,
                      }}>
                        {IMPORTANCE_LABELS[briefing.client_summary.importance].label}
                      </span>
                    )}
                    {(briefing.client_summary.yearly_revenue ?? 0) > 0 && (
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#2c1810' }}>
                        올해 매출 {fmt(briefing.client_summary.yearly_revenue!)}원
                      </span>
                    )}
                    {briefing.avg_discount_rate != null && (
                      <span style={{
                        fontSize: 11, padding: '2px 8px', borderRadius: 6,
                        background: '#fff3e0', color: '#e65100', fontWeight: 600,
                      }}>
                        평균 지원 {briefing.avg_discount_rate}%
                      </span>
                    )}
                  </div>

                  {/* 매출 요약 */}
                  <div style={{ display: 'flex', gap: 16, fontSize: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ color: '#a8a098' }}>총 구매</div>
                      <div style={{ fontWeight: 700 }}>{briefing.client_summary.total_purchases}건</div>
                    </div>
                    <div>
                      <div style={{ color: '#a8a098' }}>평균 단가</div>
                      <div style={{ fontWeight: 700 }}>{fmt(briefing.client_summary.avg_price)}원</div>
                    </div>
                    <div>
                      <div style={{ color: '#a8a098' }}>최근 주문</div>
                      <div style={{ fontWeight: 700 }}>{briefing.client_summary.last_order_date || '-'}</div>
                    </div>
                    <div>
                      <div style={{ color: '#a8a098' }}>추세</div>
                      <div style={{
                        fontWeight: 700,
                        color: briefing.client_summary.trend === 'up' ? '#2E7D32'
                          : briefing.client_summary.trend === 'down' ? '#c62828' : '#666',
                      }}>
                        {briefing.client_summary.trend === 'up' ? '상승' : briefing.client_summary.trend === 'down' ? '하락' : '유지'}
                      </div>
                    </div>
                  </div>

                  {/* 선호 태그 */}
                  {(briefing.client_summary.top_types.length > 0 || briefing.client_summary.top_countries.length > 0) && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
                      {briefing.client_summary.top_types.map(t => (
                        <span key={t} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 8, background: '#e0f2f1', color: '#00897B', fontWeight: 600 }}>{t}</span>
                      ))}
                      {briefing.client_summary.top_countries.map(c => (
                        <span key={c} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 8, background: '#ede7f6', color: '#7B1FA2', fontWeight: 600 }}>{c}</span>
                      ))}
                      {briefing.client_summary.top_grapes.slice(0, 3).map(g => (
                        <span key={g} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 8, background: '#fce4ec', color: '#c2185b', fontWeight: 600 }}>{g}</span>
                      ))}
                    </div>
                  )}

                  {/* 구매 품목 (등급 포함) */}
                  {briefing.purchased_items && briefing.purchased_items.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#2c1810', marginBottom: 6 }}>
                        구매 품목 ({briefing.purchased_items.length}건)
                      </div>
                      {briefing.purchased_items.slice(0, 10).map((it, i) => (
                          <div key={it.item_no} style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '5px 0',
                            borderBottom: i < Math.min(9, briefing.purchased_items!.length - 1) ? '1px solid rgba(90,21,21,0.06)' : 'none',
                            fontSize: 11,
                          }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#2c1810' }}>
                                {it.item_name}
                              </span>
                            </div>
                            <div style={{ flexShrink: 0, textAlign: 'right', display: 'flex', gap: 8, alignItems: 'center' }}>
                              <span style={{ color: '#a8a098', fontSize: 10 }}>{it.buy_count}회</span>
                              <span style={{ fontWeight: 600, color: '#333', minWidth: 50, textAlign: 'right' }}>
                                {it.supply_price ? fmt(it.supply_price) + '원' : '-'}
                              </span>
                            </div>
                          </div>
                      ))}
                    </div>
                  )}

                  {/* 추천 와인 Top 5 */}
                  {briefing.recommendations.length > 0 && (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#2c1810', marginBottom: 6 }}>
                        추천 와인 Top {Math.min(5, briefing.recommendations.length)}
                      </div>
                      {briefing.recommendations.slice(0, 5).map((r, i) => (
                        <div key={r.item_no} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '6px 0', borderBottom: i < Math.min(4, briefing.recommendations.length - 1) ? '1px solid rgba(90,21,21,0.06)' : 'none',
                          fontSize: 12,
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ color: r.score >= 20 ? '#c62828' : '#888', fontWeight: 600, fontSize: 11 }}>{r.score}점</span>
                              <span style={{ color: '#2c1810', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.item_name}</span>
                            </div>
                            {(r.country || r.grape) && (
                              <div style={{ fontSize: 10, color: '#a8a098', marginTop: 1 }}>
                                {[r.country, r.grape].filter(Boolean).join(' · ')}
                              </div>
                            )}
                            <div style={{ display: 'flex', gap: 3, marginTop: 2 }}>
                              {r.tags.slice(0, 3).map(tag => (
                                <span key={tag} style={{
                                  fontSize: 9, padding: '0px 4px', borderRadius: 4,
                                  background: `${TAG_COLORS[tag] || '#999'}18`,
                                  color: TAG_COLORS[tag] || '#999', fontWeight: 600,
                                }}>{tag}</span>
                              ))}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontWeight: 600 }}>{r.price ? fmt(r.price) + '원' : '-'}</div>
                          </div>
                        </div>
                      ))}

                      {/* 견적서 다운로드 */}
                      <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
                        <div style={{ position: 'relative' }}>
                          <button
                            onClick={() => setShowColSettingsId(prev => prev === m.id ? null : m.id)}
                            style={{
                              width: 32, height: 32, borderRadius: 8, border: '1px solid #ddd',
                              background: showColSettingsId === m.id ? '#f5f0eb' : '#fff', color: '#5A1515',
                              fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                            title="컬럼 설정"
                          >⚙</button>
                          {showColSettingsId === m.id && (
                            <div style={{
                              position: 'absolute', bottom: 40, left: 0, background: '#fff',
                              border: '1px solid #e0e0e0', borderRadius: 10, padding: 12,
                              boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 300,
                              width: 220, maxHeight: 280, overflowY: 'auto',
                            }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: '#5A1515', marginBottom: 6 }}>견적서 컬럼</div>
                              {QUOTE_COL_OPTIONS.map(col => (
                                <label key={col.key} style={{
                                  display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0',
                                  fontSize: 12, cursor: 'pointer', color: '#333',
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
                                    style={{ width: 13, height: 13 }}
                                  />
                                  {col.label}
                                </label>
                              ))}
                              <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
                                <button
                                  onClick={() => setQuoteCols(DEFAULT_BRIEFING_COLS)}
                                  style={{
                                    flex: 1, padding: '4px 0', borderRadius: 6, border: '1px solid #ddd',
                                    background: '#fff', fontSize: 10, cursor: 'pointer', color: '#666',
                                  }}
                                >초기화</button>
                                <button
                                  onClick={() => setShowColSettingsId(null)}
                                  style={{
                                    flex: 1, padding: '4px 0', borderRadius: 6, border: 'none',
                                    background: '#5A1515', color: '#fff', fontSize: 10, cursor: 'pointer',
                                  }}
                                >닫기</button>
                              </div>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => createQuoteFromBriefing(m, briefing)}
                          disabled={quoteLoadingId === m.id}
                          style={{
                            flex: 1, padding: '8px 12px', borderRadius: 8, border: 'none',
                            background: quoteLoadingId === m.id ? '#ccc' : 'linear-gradient(135deg, #5A1515, #8B2252)',
                            color: '#fff', fontSize: 12, fontWeight: 600,
                            cursor: quoteLoadingId === m.id ? 'default' : 'pointer',
                          }}
                        >
                          {quoteLoadingId === m.id ? '생성 중...' : '추천 와인 견적서 다운로드'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 최근 주문 */}
                  {briefing.recent_orders.length > 0 && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#2c1810', marginBottom: 6 }}>
                        최근 주문
                      </div>
                      {briefing.recent_orders.slice(0, 3).map((o, i) => (
                        <div key={i} style={{
                          display: 'flex', justifyContent: 'space-between',
                          padding: '4px 0', fontSize: 11, color: '#8a8580',
                        }}>
                          <span>{o.item_name}</span>
                          <span>{o.ship_date?.slice(5)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {isExpanded && !briefing && (
                <div style={{
                  borderTop: '1px solid rgba(90,21,21,0.06)', padding: '20px 14px',
                  textAlign: 'center', color: '#a8a098', fontSize: 13,
                }}>
                  브리핑이 아직 생성되지 않았습니다
                </div>
              )}
            </div>
          );
        })}
      </div>}

      {/* 토스트 */}
      {toast && (
        <div style={{
          position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)',
          background: '#38a169', color: '#fff', padding: '12px 24px', borderRadius: 8,
          fontSize: 14, fontWeight: 500, zIndex: 2000,
          boxShadow: '0 4px 12px rgba(90,21,21,0.1)',
        }}>{toast}</div>
      )}
    </div>
  );
}
