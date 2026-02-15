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
  };
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

function fmt(n: number) {
  if (n >= 1e8) return (n / 1e8).toFixed(1) + '억';
  if (n >= 1e4) return Math.round(n / 1e4).toLocaleString() + '만';
  return n.toLocaleString();
}

export default function BriefingTab() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(false);
  const [generatingId, setGeneratingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [toast, setToast] = useState('');

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayLabel = `${new Date().getMonth() + 1}월 ${new Date().getDate()}일`;

  // 오늘 미팅 로드
  const loadToday = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ date_from: todayStr, date_to: todayStr });
      const res = await fetch(`/api/sales/meetings?${params}`);
      const json = await res.json();
      setMeetings(json.meetings || []);
    } catch {
      setMeetings([]);
    } finally {
      setLoading(false);
    }
  }, [todayStr]);

  useEffect(() => { loadToday(); }, [loadToday]);

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
    return <div style={{ textAlign: 'center', padding: '60px', color: '#999' }}>로딩 중...</div>;
  }

  if (meetings.length === 0) {
    return (
      <div style={{
        textAlign: 'center', padding: '60px 20px', color: '#999', fontSize: 14,
      }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ddd" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 16 }}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8" />
        </svg>
        <div style={{ fontWeight: 600, color: '#666', marginBottom: 4 }}>오늘 미팅 없음</div>
        <div>{todayLabel} 예정된 미팅이 없습니다</div>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* 헤더 */}
      <div style={{
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
      </div>

      {/* 미팅 목록 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {meetings.map(m => {
          const mt = MEETING_TYPES[m.meeting_type] || MEETING_TYPES.visit;
          const st = STATUS_MAP[m.status] || STATUS_MAP.planned;
          const briefing = m.ai_briefing as BriefingData | null;
          const isExpanded = expandedId === m.id;

          return (
            <div key={m.id} style={{
              background: '#fff', borderRadius: 12,
              border: hasBriefing(m) ? '1px solid #c8e6c9' : '1px solid #f0ece4',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
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
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e', marginBottom: 3 }}>
                    {m.client_name}
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
                      <span style={{ fontSize: 11, color: '#999' }}>{m.purpose}</span>
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
                  borderTop: '1px solid #f0ece4', padding: '14px',
                  background: '#fafaf8',
                }}>
                  {/* 매출 요약 */}
                  <div style={{ display: 'flex', gap: 16, fontSize: 12, marginBottom: 12 }}>
                    <div>
                      <div style={{ color: '#999' }}>총 구매</div>
                      <div style={{ fontWeight: 700 }}>{briefing.client_summary.total_purchases}건</div>
                    </div>
                    <div>
                      <div style={{ color: '#999' }}>평균 단가</div>
                      <div style={{ fontWeight: 700 }}>{fmt(briefing.client_summary.avg_price)}원</div>
                    </div>
                    <div>
                      <div style={{ color: '#999' }}>최근 주문</div>
                      <div style={{ fontWeight: 700 }}>{briefing.client_summary.last_order_date || '-'}</div>
                    </div>
                    <div>
                      <div style={{ color: '#999' }}>추세</div>
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

                  {/* 추천 와인 Top 5 */}
                  {briefing.recommendations.length > 0 && (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e', marginBottom: 6 }}>
                        추천 와인 Top {Math.min(5, briefing.recommendations.length)}
                      </div>
                      {briefing.recommendations.slice(0, 5).map((r, i) => (
                        <div key={r.item_no} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '6px 0', borderBottom: i < Math.min(4, briefing.recommendations.length - 1) ? '1px solid #f0ece4' : 'none',
                          fontSize: 12,
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ color: r.score >= 20 ? '#c62828' : '#888', fontWeight: 600, fontSize: 11 }}>{r.score}점</span>
                              <span style={{ color: '#1a1a2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.item_name}</span>
                            </div>
                            {(r.country || r.grape) && (
                              <div style={{ fontSize: 10, color: '#999', marginTop: 1 }}>
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
                    </div>
                  )}

                  {/* 최근 주문 */}
                  {briefing.recent_orders.length > 0 && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e', marginBottom: 6 }}>
                        최근 주문
                      </div>
                      {briefing.recent_orders.slice(0, 3).map((o, i) => (
                        <div key={i} style={{
                          display: 'flex', justifyContent: 'space-between',
                          padding: '4px 0', fontSize: 11, color: '#666',
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
                  borderTop: '1px solid #f0ece4', padding: '20px 14px',
                  textAlign: 'center', color: '#999', fontSize: 13,
                }}>
                  브리핑이 아직 생성되지 않았습니다
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 토스트 */}
      {toast && (
        <div style={{
          position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)',
          background: '#38a169', color: '#fff', padding: '12px 24px', borderRadius: 8,
          fontSize: 14, fontWeight: 500, zIndex: 2000,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}>{toast}</div>
      )}
    </div>
  );
}
