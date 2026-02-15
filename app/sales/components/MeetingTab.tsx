'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ── 타입 ──
interface ClientOption {
  client_code: string;
  client_name: string;
  importance?: number;
  manager?: string;
  business_type?: string;
}

interface Meeting {
  id: number;
  client_code: string;
  meeting_date: string;
  meeting_time: string | null;
  meeting_type: string;
  status: string;
  purpose: string | null;
  notes: string | null;
  ai_briefing: any;
  client_name: string;
  client_importance: number;
  client_business_type: string;
  client_manager: string;
  client_contact: string;
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

// ── 상수 ──
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

const STATUS_FLOW = ['planned', 'confirmed', 'completed'];

const IMPORTANCE_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'VIP', color: '#dc3545' },
  2: { label: '중요', color: '#fd7e14' },
  3: { label: '일반', color: '#6c757d' },
  4: { label: '간헐', color: '#adb5bd' },
  5: { label: '비활성', color: '#dee2e6' },
};

const TAG_COLORS: Record<string, string> = {
  '재주문': '#2196F3', '선호국가': '#9C27B0', '선호품종': '#E91E63',
  '선호타입': '#00897B', '적정가격': '#4CAF50', '프리미엄': '#FF9800',
  '인기': '#FF5722', '통관필요': '#795548',
  '봄': '#66BB6A', '여름': '#29B6F6', '가을': '#FF7043', '겨울': '#5C6BC0',
};

const DAYS_KR = ['일', '월', '화', '수', '목', '금', '토'];

function fmt(n: number) {
  if (n >= 1e8) return (n / 1e8).toFixed(1) + '억';
  if (n >= 1e4) return Math.round(n / 1e4).toLocaleString() + '만';
  return n.toLocaleString();
}

function getWeekRange(baseDate: Date): { start: Date; end: Date } {
  const d = new Date(baseDate);
  const day = d.getDay();
  const start = new Date(d);
  start.setDate(d.getDate() - day + 1); // 월요일
  const end = new Date(start);
  end.setDate(start.getDate() + 6); // 일요일
  return { start, end };
}

function getMonthRange(baseDate: Date): { start: Date; end: Date } {
  const start = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  const end = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0);
  return { start, end };
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatDateKR(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}(${DAYS_KR[d.getDay()]})`;
}

export default function MeetingTab() {
  // ── 상태 ──
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const [weekBase, setWeekBase] = useState(new Date());
  const [filterManager, setFilterManager] = useState('');
  const [managers, setManagers] = useState<string[]>([]);

  // 생성 모달
  const [showModal, setShowModal] = useState(false);
  const [modalDate, setModalDate] = useState('');
  const [modalTime, setModalTime] = useState('10:00');
  const [modalType, setModalType] = useState('visit');
  const [modalPurpose, setModalPurpose] = useState('');
  const [modalClient, setModalClient] = useState<ClientOption | null>(null);
  const [modalClientSearch, setModalClientSearch] = useState('');
  const [modalClientOptions, setModalClientOptions] = useState<ClientOption[]>([]);
  const [modalShowDropdown, setModalShowDropdown] = useState(false);
  const [modalSaving, setModalSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const modalDropdownRef = useRef<HTMLDivElement>(null);
  const modalSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 상세 패널
  const [detailMeeting, setDetailMeeting] = useState<Meeting | null>(null);
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [selectedRecs, setSelectedRecs] = useState<Set<string>>(new Set());
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [detailNotes, setDetailNotes] = useState('');
  const [toast, setToast] = useState('');

  // ── 날짜 범위 ──
  const { start: weekStart, end: weekEnd } = viewMode === 'week'
    ? getWeekRange(weekBase)
    : getMonthRange(weekBase);
  const rangeLabel = viewMode === 'week'
    ? `${weekStart.getMonth() + 1}/${weekStart.getDate()} ~ ${weekEnd.getMonth() + 1}/${weekEnd.getDate()}`
    : `${weekBase.getFullYear()}년 ${weekBase.getMonth() + 1}월`;

  // ── 담당자 로드 ──
  useEffect(() => {
    fetch('/api/sales/clients/managers')
      .then(r => r.json())
      .then(d => { if (d.managers) setManagers(d.managers); })
      .catch(() => {});
  }, []);

  // ── 미팅 로드 ──
  const loadMeetings = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        date_from: formatDate(weekStart),
        date_to: formatDate(weekEnd),
      });
      if (filterManager) params.set('manager', filterManager);
      const res = await fetch(`/api/sales/meetings?${params}`);
      const json = await res.json();
      setMeetings(json.meetings || []);
    } catch {
      setMeetings([]);
    } finally {
      setLoading(false);
    }
  }, [formatDate(weekStart), formatDate(weekEnd), filterManager]);

  useEffect(() => { loadMeetings(); }, [loadMeetings]);

  // ── 날짜 배열 ──
  const rangeDates: string[] = [];
  const dayCount = Math.round((weekEnd.getTime() - weekStart.getTime()) / (86400000)) + 1;
  for (let i = 0; i < dayCount; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    rangeDates.push(formatDate(d));
  }

  // 날짜별 미팅 그룹
  const meetingsByDate: Record<string, Meeting[]> = {};
  for (const d of rangeDates) meetingsByDate[d] = [];
  for (const m of meetings) {
    const d = m.meeting_date?.slice(0, 10);
    if (meetingsByDate[d]) meetingsByDate[d].push(m);
  }

  // 월간뷰: 주차별 그룹
  const weekGroups: string[][] = [];
  if (viewMode === 'month') {
    let currentWeek: string[] = [];
    for (const dateStr of rangeDates) {
      const d = new Date(dateStr + 'T00:00:00');
      if (currentWeek.length > 0 && d.getDay() === 1) {
        weekGroups.push(currentWeek);
        currentWeek = [];
      }
      currentWeek.push(dateStr);
    }
    if (currentWeek.length > 0) weekGroups.push(currentWeek);
  }

  // ── 기간 이동 ──
  const prevPeriod = () => {
    const d = new Date(weekBase);
    if (viewMode === 'week') d.setDate(d.getDate() - 7);
    else d.setMonth(d.getMonth() - 1);
    setWeekBase(d);
  };
  const nextPeriod = () => {
    const d = new Date(weekBase);
    if (viewMode === 'week') d.setDate(d.getDate() + 7);
    else d.setMonth(d.getMonth() + 1);
    setWeekBase(d);
  };
  const goToday = () => setWeekBase(new Date());

  // ── 거래처 검색 (모달) ──
  const searchClients = useCallback(async (q: string) => {
    try {
      const params = new URLSearchParams({ search: q, limit: '30', type: 'wine' });
      const res = await fetch(`/api/sales/clients?${params}`);
      const json = await res.json();
      setModalClientOptions(json.clients || []);
      setModalShowDropdown(true);
    } catch {
      setModalClientOptions([]);
    }
  }, []);

  useEffect(() => {
    if (modalSearchTimer.current) clearTimeout(modalSearchTimer.current);
    if (modalClientSearch.length >= 1) {
      modalSearchTimer.current = setTimeout(() => searchClients(modalClientSearch), 300);
    } else {
      setModalClientOptions([]);
      setModalShowDropdown(false);
    }
    return () => { if (modalSearchTimer.current) clearTimeout(modalSearchTimer.current); };
  }, [modalClientSearch, searchClients]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (modalDropdownRef.current && !modalDropdownRef.current.contains(e.target as Node)) {
        setModalShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // 토스트
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // ── 미팅 생성/수정 ──
  const openCreateModal = (date?: string) => {
    setEditingId(null);
    setModalDate(date || formatDate(new Date()));
    setModalTime('10:00');
    setModalType('visit');
    setModalPurpose('');
    setModalClient(null);
    setModalClientSearch('');
    setShowModal(true);
  };

  const saveMeeting = async () => {
    if (!modalClient) return;
    setModalSaving(true);
    try {
      const body: any = {
        client_code: modalClient.client_code,
        meeting_date: modalDate,
        meeting_time: modalTime,
        meeting_type: modalType,
        purpose: modalPurpose,
      };
      if (editingId) body.id = editingId;

      const res = await fetch('/api/sales/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.error) { setToast('오류: ' + json.error); return; }
      setShowModal(false);
      setToast(editingId ? '미팅이 수정되었습니다.' : '미팅이 생성되었습니다.');
      loadMeetings();
    } catch {
      setToast('저장에 실패했습니다.');
    } finally {
      setModalSaving(false);
    }
  };

  // ── 미팅 삭제 ──
  const deleteMeeting = async (id: number) => {
    if (!confirm('이 미팅을 삭제하시겠습니까?')) return;
    try {
      await fetch(`/api/sales/meetings?id=${id}`, { method: 'DELETE' });
      setToast('미팅이 삭제되었습니다.');
      if (detailMeeting?.id === id) setDetailMeeting(null);
      loadMeetings();
    } catch {
      setToast('삭제에 실패했습니다.');
    }
  };

  // ── 상태 변경 ──
  const changeStatus = async (meeting: Meeting, newStatus: string) => {
    try {
      const res = await fetch('/api/sales/meetings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: meeting.id, status: newStatus, notes: detailNotes || meeting.notes }),
      });
      const json = await res.json();
      if (json.error) { setToast('오류: ' + json.error); return; }
      setToast(`상태가 "${STATUS_MAP[newStatus]?.label}"(으)로 변경되었습니다.`);
      loadMeetings();
      if (detailMeeting?.id === meeting.id) {
        setDetailMeeting({ ...detailMeeting, status: newStatus });
      }
    } catch {
      setToast('상태 변경에 실패했습니다.');
    }
  };

  // ── 브리핑 생성 ──
  const generateBriefing = async (meeting: Meeting) => {
    setBriefingLoading(true);
    setBriefing(null);
    setSelectedRecs(new Set());
    try {
      const res = await fetch('/api/sales/meetings/briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meeting_id: meeting.id, client_code: meeting.client_code }),
      });
      const json = await res.json();
      if (json.error) { setToast('브리핑 생성 실패: ' + json.error); return; }
      setBriefing(json.briefing);
      // 상위 5개 자동 선택
      const autoSelect = new Set<string>();
      (json.briefing?.recommendations || []).slice(0, 5).forEach((r: any) => autoSelect.add(r.item_no));
      setSelectedRecs(autoSelect);
    } catch {
      setToast('브리핑 생성에 실패했습니다.');
    } finally {
      setBriefingLoading(false);
    }
  };

  // ── 견적서 생성 ──
  const createQuote = async () => {
    if (!briefing || selectedRecs.size === 0) return;
    setQuoteLoading(true);
    try {
      const items = briefing.recommendations.filter(r => selectedRecs.has(r.item_no));
      const res = await fetch('/api/sales/recommend/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          client_code: detailMeeting?.client_code,
          client_name: detailMeeting?.client_name,
          clear_existing: true,
        }),
      });
      const json = await res.json();
      if (json.error) { setToast('오류: ' + json.error); return; }

      // Excel 다운로드
      const recCols = [
        'country', 'brand', 'region', 'grape_varieties',
        'image_url', 'vintage', 'product_name',
        'supply_price', 'retail_price', 'discount_rate', 'discounted_price',
        'tasting_note', 'note',
      ];
      const params = new URLSearchParams();
      params.set('columns', JSON.stringify(recCols));
      if (detailMeeting?.client_name) params.set('client_name', detailMeeting.client_name);
      window.location.href = `/api/quote/export?${params}`;
      setToast(`${json.added_count}개 와인 견적서 생성 완료`);
    } catch {
      setToast('견적서 생성에 실패했습니다.');
    } finally {
      setQuoteLoading(false);
    }
  };

  // ── 상세 열기 ──
  const openDetail = (m: Meeting) => {
    setDetailMeeting(m);
    setDetailNotes(m.notes || '');
    if (m.ai_briefing) {
      setBriefing(m.ai_briefing as BriefingData);
      const autoSelect = new Set<string>();
      (m.ai_briefing?.recommendations || []).slice(0, 5).forEach((r: any) => autoSelect.add(r.item_no));
      setSelectedRecs(autoSelect);
    } else {
      setBriefing(null);
      setSelectedRecs(new Set());
    }
  };

  const toggleRec = (itemNo: string) => {
    setSelectedRecs(prev => {
      const next = new Set(prev);
      if (next.has(itemNo)) next.delete(itemNo);
      else next.add(itemNo);
      return next;
    });
  };

  // 오늘 판별
  const todayStr = formatDate(new Date());

  // ═══════════════════════════════════════
  // 렌더링
  // ═══════════════════════════════════════
  return (
    <div style={{ paddingBottom: 100 }}>
      {/* ── 상단: 뷰 토글 + 담당자 + 네비게이션 ── */}
      <div style={{
        background: '#fff', borderRadius: 12, padding: '16px',
        marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        border: '1px solid #f0ece4',
      }}>
        {/* 주간/월간 토글 */}
        <div style={{
          display: 'flex', background: '#f5f3ed', borderRadius: 8,
          padding: 3, marginBottom: 12, gap: 2,
        }}>
          {(['week', 'month'] as const).map(mode => (
            <button key={mode} onClick={() => setViewMode(mode)} style={{
              flex: 1, padding: '7px 0', borderRadius: 6, border: 'none',
              background: viewMode === mode ? '#fff' : 'transparent',
              color: viewMode === mode ? '#5A1515' : '#999',
              fontWeight: viewMode === mode ? 700 : 500,
              fontSize: 13, cursor: 'pointer',
              boxShadow: viewMode === mode ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.2s',
            }}>
              {mode === 'week' ? '주간' : '월간'}
            </button>
          ))}
        </div>

        {managers.length > 0 && (
          <select
            value={filterManager}
            onChange={e => setFilterManager(e.target.value)}
            style={{
              padding: '8px 12px', borderRadius: 6, border: '1px solid #e0dcd4',
              fontSize: 16, background: '#fff', color: filterManager ? '#1a1a2e' : '#999',
              outline: 'none', width: '100%', marginBottom: 12, boxSizing: 'border-box',
            }}
          >
            <option value="">전체 담당자</option>
            {managers.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={prevPeriod} style={{
            background: 'none', border: '1px solid #e0dcd4', borderRadius: 6,
            padding: '6px 12px', cursor: 'pointer', fontSize: 14, color: '#666',
          }}>←</button>
          <div style={{ textAlign: 'center' }}>
            <button onClick={goToday} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 15, fontWeight: 700, color: '#1a1a2e',
            }}>{rangeLabel}</button>
            {viewMode === 'week' && <div style={{ fontSize: 11, color: '#999' }}>{weekStart.getFullYear()}</div>}
          </div>
          <button onClick={nextPeriod} style={{
            background: 'none', border: '1px solid #e0dcd4', borderRadius: 6,
            padding: '6px 12px', cursor: 'pointer', fontSize: 14, color: '#666',
          }}>→</button>
        </div>
      </div>

      {/* ── 미팅 리스트 ── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>로딩 중...</div>
      ) : viewMode === 'month' ? (
        /* ── 월간 뷰: 캘린더 그리드 ── */
        <div style={{
          background: '#fff', borderRadius: 12,
          border: '1px solid #f0ece4',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          overflow: 'hidden',
        }}>
          {/* 요일 헤더 */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
            borderBottom: '1px solid #f0ece4', background: '#faf8f2',
          }}>
            {DAYS_KR.slice(1).concat(DAYS_KR[0]).map(day => (
              <div key={day} style={{
                textAlign: 'center', padding: '8px 0',
                fontSize: 11, fontWeight: 600,
                color: day === '일' ? '#c62828' : day === '토' ? '#1565C0' : '#666',
              }}>{day}</div>
            ))}
          </div>

          {/* 주차별 행 */}
          {weekGroups.map((week, wi) => (
            <div key={wi} style={{
              display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
              borderBottom: wi < weekGroups.length - 1 ? '1px solid #f0ece4' : 'none',
            }}>
              {/* 첫 주 빈칸 채우기 */}
              {wi === 0 && (() => {
                const firstDay = new Date(week[0] + 'T00:00:00').getDay();
                const emptyCount = firstDay === 0 ? 6 : firstDay - 1; // 월=0, 화=1 ... 일=6
                return Array.from({ length: emptyCount }).map((_, i) => (
                  <div key={`e${i}`} style={{ borderRight: '1px solid #f8f6f0', minHeight: 102, background: '#fcfcfb' }} />
                ));
              })()}

              {week.map(dateStr => {
                const dayMeetings = meetingsByDate[dateStr] || [];
                const isToday = dateStr === todayStr;
                const isPast = dateStr < todayStr;
                const d = new Date(dateStr + 'T00:00:00');
                const dayNum = d.getDate();
                const isSun = d.getDay() === 0;
                const isSat = d.getDay() === 6;

                return (
                  <div key={dateStr} style={{
                    borderRight: '1px solid #f8f6f0',
                    minHeight: 102, padding: '4px',
                    background: isToday ? '#faf0f2' : isPast ? '#fdfcfa' : '#fff',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    minWidth: 0,
                  }} onClick={() => openCreateModal(dateStr)}>
                    <div style={{
                      fontSize: 12, fontWeight: isToday ? 800 : 500,
                      color: isToday ? '#fff' : isSun ? '#c62828' : isSat ? '#1565C0' : isPast ? '#bbb' : '#1a1a2e',
                      textAlign: 'center', marginBottom: 2,
                      ...(isToday ? {
                        background: '#5A1515', borderRadius: '50%',
                        width: 22, height: 22, lineHeight: '22px',
                        margin: '0 auto 2px',
                      } : {}),
                    }}>{dayNum}</div>

                    {dayMeetings.slice(0, 3).map(m => {
                      const mt = MEETING_TYPES[m.meeting_type] || MEETING_TYPES.visit;
                      return (
                        <div key={m.id} onClick={e => { e.stopPropagation(); openDetail(m); }} style={{
                          fontSize: 9, padding: '1px 3px', marginBottom: 1,
                          borderRadius: 3, overflow: 'hidden',
                          whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                          background: `${mt.color}18`, color: mt.color,
                          fontWeight: 600, cursor: 'pointer',
                          maxWidth: '100%',
                        }}>
                          {m.meeting_time?.slice(0, 5) || ''} {m.client_name}
                        </div>
                      );
                    })}
                    {dayMeetings.length > 3 && (
                      <div style={{ fontSize: 9, color: '#999', textAlign: 'center' }}>
                        +{dayMeetings.length - 3}건
                      </div>
                    )}
                  </div>
                );
              })}

              {/* 마지막 주 빈칸 채우기 */}
              {wi === weekGroups.length - 1 && (() => {
                const lastDay = new Date(week[week.length - 1] + 'T00:00:00').getDay();
                const emptyCount = lastDay === 0 ? 0 : 7 - lastDay;
                return Array.from({ length: emptyCount }).map((_, i) => (
                  <div key={`le${i}`} style={{ borderRight: '1px solid #f8f6f0', minHeight: 102, background: '#fcfcfb' }} />
                ));
              })()}
            </div>
          ))}

          {/* 월간 요약 */}
          <div style={{
            padding: '10px 14px', background: '#faf8f2', borderTop: '1px solid #f0ece4',
            fontSize: 12, color: '#666', display: 'flex', justifyContent: 'space-between',
          }}>
            <span>총 {meetings.length}건의 미팅</span>
            <span>
              {Object.values(MEETING_TYPES).map(mt => {
                const cnt = meetings.filter(m => MEETING_TYPES[m.meeting_type]?.label === mt.label).length;
                return cnt > 0 ? `${mt.label} ${cnt}` : null;
              }).filter(Boolean).join(' · ')}
            </span>
          </div>
        </div>
      ) : (
        /* ── 주간 뷰: 기존 날짜별 리스트 ── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {rangeDates.map(dateStr => {
            const dayMeetings = meetingsByDate[dateStr] || [];
            const isToday = dateStr === todayStr;
            const isPast = dateStr < todayStr;

            return (
              <div key={dateStr} style={{
                background: '#fff', borderRadius: 12,
                border: isToday ? '2px solid #5A1515' : '1px solid #f0ece4',
                boxShadow: isToday ? '0 2px 8px rgba(90,21,21,0.12)' : '0 1px 3px rgba(0,0,0,0.04)',
                overflow: 'hidden',
              }}>
                {/* 날짜 헤더 */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 14px',
                  background: isToday ? '#faf0f2' : isPast ? '#fafafa' : '#fff',
                  borderBottom: '1px solid #f0ece4',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      fontSize: 14, fontWeight: 700,
                      color: isToday ? '#5A1515' : isPast ? '#aaa' : '#1a1a2e',
                    }}>
                      {formatDateKR(dateStr)}
                    </span>
                    {isToday && (
                      <span style={{
                        fontSize: 10, padding: '2px 6px', borderRadius: 8,
                        background: '#5A1515', color: '#fff', fontWeight: 600,
                      }}>TODAY</span>
                    )}
                    {dayMeetings.length > 0 && (
                      <span style={{ fontSize: 11, color: '#999' }}>{dayMeetings.length}건</span>
                    )}
                  </div>
                  <button onClick={() => openCreateModal(dateStr)} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 20, color: '#5A1515', padding: '0 4px', lineHeight: 1,
                  }}>+</button>
                </div>

                {/* 미팅 카드들 */}
                {dayMeetings.length === 0 ? (
                  <div style={{
                    padding: '16px 14px', textAlign: 'center',
                    color: '#ccc', fontSize: 13,
                  }}>
                    미팅 없음
                  </div>
                ) : (
                  <div>
                    {dayMeetings.map(m => {
                      const mt = MEETING_TYPES[m.meeting_type] || MEETING_TYPES.visit;
                      const st = STATUS_MAP[m.status] || STATUS_MAP.planned;
                      const imp = IMPORTANCE_LABELS[m.client_importance] || IMPORTANCE_LABELS[3];

                      return (
                        <div key={m.id} onClick={() => openDetail(m)} style={{
                          padding: '12px 14px', cursor: 'pointer',
                          borderBottom: '1px solid #f8f6f0',
                          display: 'flex', alignItems: 'center', gap: 12,
                          transition: 'background 0.15s',
                        }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#faf8f2')}
                          onMouseLeave={e => (e.currentTarget.style.background = '')}
                        >
                          {/* 시간 */}
                          <div style={{
                            width: 48, flexShrink: 0, textAlign: 'center',
                            fontSize: 13, fontWeight: 600, color: '#5A1515',
                          }}>
                            {m.meeting_time || '--:--'}
                          </div>

                          {/* 내용 */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                              <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e' }}>
                                {m.client_name}
                              </span>
                              <span style={{
                                fontSize: 9, padding: '1px 5px', borderRadius: 6,
                                background: imp.color, color: '#fff', fontWeight: 600,
                              }}>{imp.label}</span>
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
                                <span style={{ fontSize: 11, color: '#999', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {m.purpose}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* 브리핑 여부 */}
                          <div style={{ flexShrink: 0 }}>
                            {m.ai_briefing ? (
                              <span style={{ fontSize: 10, color: '#4CAF50', fontWeight: 600 }}>브리핑O</span>
                            ) : (
                              <span style={{ fontSize: 10, color: '#ccc' }}>브리핑-</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ 미팅 생성/수정 모달 ═══ */}
      {showModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
        }} onClick={() => setShowModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#fff', borderRadius: 16, padding: '24px 20px',
            width: '100%', maxWidth: 400, maxHeight: '90vh', overflowY: 'auto',
          }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e', marginBottom: 20 }}>
              {editingId ? '미팅 수정' : '미팅 추가'}
            </div>

            {/* 거래처 검색 */}
            <label style={{ fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 6 }}>거래처</label>
            <div ref={modalDropdownRef} style={{ position: 'relative', marginBottom: 14 }}>
              <input
                type="text"
                placeholder="거래처명으로 검색..."
                value={modalClientSearch}
                onChange={e => { setModalClientSearch(e.target.value); setModalClient(null); }}
                onFocus={() => { if (modalClientOptions.length > 0) setModalShowDropdown(true); }}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 8,
                  border: '1px solid #e0dcd4', fontSize: 16, outline: 'none',
                  boxSizing: 'border-box', background: modalClient ? '#f8f6f0' : '#fff',
                }}
              />
              {modalClient && (
                <button onClick={() => { setModalClient(null); setModalClientSearch(''); }} style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#999',
                }}>×</button>
              )}
              {modalShowDropdown && modalClientOptions.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0,
                  background: '#fff', border: '1px solid #e0dcd4',
                  borderRadius: '0 0 8px 8px', maxHeight: 200, overflowY: 'auto',
                  zIndex: 100, boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                }}>
                  {modalClientOptions.map(c => (
                    <div key={c.client_code} onClick={() => {
                      setModalClient(c); setModalClientSearch(c.client_name); setModalShowDropdown(false);
                    }} style={{
                      padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #f5f3ed',
                    }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#faf8f2')}
                      onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                    >
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{c.client_name}</div>
                      <div style={{ fontSize: 11, color: '#999' }}>
                        {c.client_code}{c.manager && ` · ${c.manager}`}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 날짜 */}
            <label style={{ fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 6 }}>날짜</label>
            <input type="date" value={modalDate} onChange={e => setModalDate(e.target.value)} style={{
              width: '100%', padding: '10px 12px', borderRadius: 8,
              border: '1px solid #e0dcd4', fontSize: 16, outline: 'none',
              marginBottom: 14, boxSizing: 'border-box',
            }} />

            {/* 시간 */}
            <label style={{ fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 6 }}>시간</label>
            <input type="time" value={modalTime} onChange={e => setModalTime(e.target.value)} style={{
              width: '100%', padding: '10px 12px', borderRadius: 8,
              border: '1px solid #e0dcd4', fontSize: 16, outline: 'none',
              marginBottom: 14, boxSizing: 'border-box',
            }} />

            {/* 미팅 타입 */}
            <label style={{ fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 6 }}>미팅 타입</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {Object.entries(MEETING_TYPES).map(([key, { label, color }]) => (
                <button key={key} onClick={() => setModalType(key)} style={{
                  flex: 1, padding: '8px', borderRadius: 8, border: 'none',
                  background: modalType === key ? `${color}20` : '#f5f3ed',
                  color: modalType === key ? color : '#999',
                  fontWeight: modalType === key ? 700 : 500,
                  fontSize: 13, cursor: 'pointer',
                  outline: modalType === key ? `2px solid ${color}` : 'none',
                }}>{label}</button>
              ))}
            </div>

            {/* 목적 */}
            <label style={{ fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 6 }}>목적/메모</label>
            <textarea
              value={modalPurpose}
              onChange={e => setModalPurpose(e.target.value)}
              placeholder="미팅 목적..."
              rows={3}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8,
                border: '1px solid #e0dcd4', fontSize: 16, outline: 'none',
                marginBottom: 20, boxSizing: 'border-box', resize: 'vertical',
                fontFamily: 'inherit',
              }}
            />

            {/* 버튼 */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowModal(false)} style={{
                flex: 1, padding: '12px', borderRadius: 8, border: '1px solid #e0dcd4',
                background: '#fff', color: '#666', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}>취소</button>
              <button onClick={saveMeeting} disabled={!modalClient || modalSaving} style={{
                flex: 1, padding: '12px', borderRadius: 8, border: 'none',
                background: !modalClient || modalSaving ? '#ccc' : 'linear-gradient(135deg, #5A1515, #8B2252)',
                color: '#fff', fontSize: 14, fontWeight: 600,
                cursor: !modalClient || modalSaving ? 'default' : 'pointer',
              }}>{modalSaving ? '저장 중...' : '저장'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ 미팅 상세 패널 ═══ */}
      {detailMeeting && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        }} onClick={() => { setDetailMeeting(null); setBriefing(null); }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#fff', borderRadius: '16px 16px 0 0',
            width: '100%', maxWidth: 600,
            maxHeight: '92vh', overflowY: 'auto',
            padding: '20px 16px 40px',
          }}>
            {/* 드래그 바 */}
            <div style={{ width: 40, height: 4, background: '#ddd', borderRadius: 2, margin: '0 auto 16px' }} />

            {/* 거래처 정보 */}
            <div style={{
              background: 'linear-gradient(135deg, #5A1515, #8B2252)',
              borderRadius: 12, padding: 16, color: '#fff', marginBottom: 16,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{detailMeeting.client_name}</div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>
                    {detailMeeting.client_business_type || '업종 미설정'}
                    {detailMeeting.client_manager && ` · ${detailMeeting.client_manager}`}
                  </div>
                </div>
                <span style={{
                  padding: '4px 10px', borderRadius: 12, background: 'rgba(255,255,255,0.2)', fontSize: 12,
                }}>{IMPORTANCE_LABELS[detailMeeting.client_importance]?.label || '일반'}</span>
              </div>
              <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                <div>
                  <div style={{ opacity: 0.7 }}>날짜</div>
                  <div style={{ fontWeight: 600 }}>{formatDateKR(detailMeeting.meeting_date)}</div>
                </div>
                <div>
                  <div style={{ opacity: 0.7 }}>시간</div>
                  <div style={{ fontWeight: 600 }}>{detailMeeting.meeting_time || '--:--'}</div>
                </div>
                <div>
                  <div style={{ opacity: 0.7 }}>타입</div>
                  <div style={{ fontWeight: 600 }}>{MEETING_TYPES[detailMeeting.meeting_type]?.label || detailMeeting.meeting_type}</div>
                </div>
                <div>
                  <div style={{ opacity: 0.7 }}>상태</div>
                  <div style={{ fontWeight: 600 }}>{STATUS_MAP[detailMeeting.status]?.label || detailMeeting.status}</div>
                </div>
              </div>
              {detailMeeting.purpose && (
                <div style={{ marginTop: 10, fontSize: 12, opacity: 0.9, fontStyle: 'italic' }}>
                  {detailMeeting.purpose}
                </div>
              )}
            </div>

            {/* 상태 변경 */}
            <div style={{
              display: 'flex', gap: 8, marginBottom: 16,
            }}>
              {STATUS_FLOW.map(s => {
                const sm = STATUS_MAP[s];
                const isCurrent = detailMeeting.status === s;
                return (
                  <button key={s} onClick={() => !isCurrent && changeStatus(detailMeeting, s)} style={{
                    flex: 1, padding: '8px', borderRadius: 8,
                    border: isCurrent ? `2px solid ${sm.color}` : '1px solid #e0dcd4',
                    background: isCurrent ? sm.bg : '#fff',
                    color: isCurrent ? sm.color : '#999',
                    fontWeight: isCurrent ? 700 : 500,
                    fontSize: 12, cursor: isCurrent ? 'default' : 'pointer',
                  }}>{sm.label}</button>
                );
              })}
              <button onClick={() => deleteMeeting(detailMeeting.id)} style={{
                padding: '8px 12px', borderRadius: 8, border: '1px solid #ffcdd2',
                background: '#fff', color: '#c62828', fontSize: 12, cursor: 'pointer',
              }}>삭제</button>
            </div>

            {/* 브리핑 생성 버튼 */}
            <button onClick={() => generateBriefing(detailMeeting)} disabled={briefingLoading} style={{
              width: '100%', padding: '12px', borderRadius: 8, border: 'none',
              background: briefingLoading ? '#ccc' : 'linear-gradient(135deg, #1a237e, #4a148c)',
              color: '#fff', fontSize: 14, fontWeight: 600, marginBottom: 16,
              cursor: briefingLoading ? 'default' : 'pointer',
            }}>
              {briefingLoading ? '브리핑 생성 중...' : briefing ? '브리핑 새로고침' : 'AI 브리핑 생성'}
            </button>

            {/* 브리핑 결과 */}
            {briefing && (
              <div>
                {/* 거래처 매출 요약 */}
                <div style={{
                  background: '#f8f6f0', borderRadius: 10, padding: 14, marginBottom: 12,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 10 }}>
                    거래처 매출 요약
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 12 }}>
                    <div>
                      <div style={{ color: '#999', marginBottom: 2 }}>총 구매</div>
                      <div style={{ fontWeight: 700, color: '#1a1a2e' }}>{briefing.client_summary.total_purchases}건</div>
                    </div>
                    <div>
                      <div style={{ color: '#999', marginBottom: 2 }}>평균 단가</div>
                      <div style={{ fontWeight: 700, color: '#1a1a2e' }}>{fmt(briefing.client_summary.avg_price)}원</div>
                    </div>
                    <div>
                      <div style={{ color: '#999', marginBottom: 2 }}>최근 주문</div>
                      <div style={{ fontWeight: 700, color: '#1a1a2e' }}>{briefing.client_summary.last_order_date || '-'}</div>
                    </div>
                    <div>
                      <div style={{ color: '#999', marginBottom: 2 }}>추세</div>
                      <div style={{
                        fontWeight: 700,
                        color: briefing.client_summary.trend === 'up' ? '#2E7D32'
                          : briefing.client_summary.trend === 'down' ? '#c62828' : '#666',
                      }}>
                        {briefing.client_summary.trend === 'up' ? '상승' : briefing.client_summary.trend === 'down' ? '하락' : '유지'}
                      </div>
                    </div>
                  </div>
                  {(briefing.client_summary.top_countries.length > 0 || briefing.client_summary.top_grapes.length > 0) && (
                    <div style={{ marginTop: 10, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {briefing.client_summary.top_types.map(t => (
                        <span key={t} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 8, background: '#e0f2f1', color: '#00897B', fontWeight: 600 }}>{t}</span>
                      ))}
                      {briefing.client_summary.top_countries.map(c => (
                        <span key={c} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 8, background: '#ede7f6', color: '#7B1FA2', fontWeight: 600 }}>{c}</span>
                      ))}
                      {briefing.client_summary.top_grapes.map(g => (
                        <span key={g} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 8, background: '#fce4ec', color: '#c2185b', fontWeight: 600 }}>{g}</span>
                      ))}
                    </div>
                  )}
                </div>

                {/* 최근 주문 */}
                {briefing.recent_orders.length > 0 && (
                  <div style={{
                    background: '#fff', borderRadius: 10, padding: 14, marginBottom: 12,
                    border: '1px solid #f0ece4',
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 10 }}>
                      최근 주문 내역
                    </div>
                    {briefing.recent_orders.map((o, i) => (
                      <div key={i} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '6px 0', borderBottom: i < briefing.recent_orders.length - 1 ? '1px solid #f5f3ed' : 'none',
                        fontSize: 12,
                      }}>
                        <span style={{ color: '#1a1a2e', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.item_name}</span>
                        <span style={{ color: '#999', flexShrink: 0, marginLeft: 8 }}>{o.quantity}개 · {o.ship_date?.slice(5)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* 추천 와인 */}
                <div style={{
                  fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 8,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span>추천 와인 {briefing.recommendations.length}개</span>
                  <span style={{ fontSize: 11, color: '#5A1515', fontWeight: 500 }}>
                    {selectedRecs.size}개 선택
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                  {briefing.recommendations.map(r => {
                    const isSelected = selectedRecs.has(r.item_no);
                    return (
                      <div key={r.item_no} onClick={() => toggleRec(r.item_no)} style={{
                        background: '#fff', borderRadius: 8, padding: '10px 12px',
                        border: isSelected ? '2px solid #5A1515' : '1px solid #f0ece4',
                        cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'center',
                      }}>
                        <div style={{
                          width: 20, height: 20, borderRadius: 5, flexShrink: 0,
                          border: isSelected ? '2px solid #5A1515' : '2px solid #ddd',
                          background: isSelected ? '#5A1515' : '#fff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {isSelected && (
                            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                              <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', marginBottom: 3 }}>
                            <span style={{ color: r.score >= 20 ? '#c62828' : '#888', marginRight: 6, fontSize: 11 }}>{r.score}점</span>
                            {r.item_name}
                          </div>
                          {(r.country || r.grape) && (
                            <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>
                              {[r.country, r.region, r.grape].filter(Boolean).join(' · ')}
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                            {r.tags.map(tag => (
                              <span key={tag} style={{
                                fontSize: 9, padding: '1px 5px', borderRadius: 6,
                                background: `${TAG_COLORS[tag] || '#999'}18`,
                                color: TAG_COLORS[tag] || '#999', fontWeight: 600,
                              }}>{tag}</span>
                            ))}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0, fontSize: 12 }}>
                          <div style={{ fontWeight: 700, color: '#1a1a2e' }}>{r.price ? fmt(r.price) + '원' : '-'}</div>
                          <div style={{ color: '#999', fontSize: 11 }}>재고 {r.stock}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 견적서 생성 버튼 */}
                {selectedRecs.size > 0 && (
                  <button onClick={createQuote} disabled={quoteLoading} style={{
                    width: '100%', padding: '14px', borderRadius: 10, border: 'none',
                    background: quoteLoading ? '#ccc' : 'linear-gradient(135deg, #5A1515, #8B2252)',
                    color: '#fff', fontSize: 14, fontWeight: 700, marginBottom: 16,
                    cursor: quoteLoading ? 'default' : 'pointer',
                  }}>
                    {quoteLoading ? '생성 중...' : `선택 ${selectedRecs.size}개 → 견적서 생성 & 다운로드`}
                  </button>
                )}
              </div>
            )}

            {/* 메모 */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 6 }}>메모</label>
              <textarea
                value={detailNotes}
                onChange={e => setDetailNotes(e.target.value)}
                placeholder="미팅 메모..."
                rows={3}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 8,
                  border: '1px solid #e0dcd4', fontSize: 16, outline: 'none',
                  boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit',
                }}
              />
              {detailNotes !== (detailMeeting.notes || '') && (
                <button onClick={async () => {
                  await fetch('/api/sales/meetings', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: detailMeeting.id, status: detailMeeting.status, notes: detailNotes }),
                  });
                  setToast('메모가 저장되었습니다.');
                  loadMeetings();
                }} style={{
                  marginTop: 8, padding: '8px 16px', borderRadius: 6, border: 'none',
                  background: '#5A1515', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}>메모 저장</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 토스트 ── */}
      {toast && (
        <div style={{
          position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)',
          background: toast.startsWith('오류') ? '#c53030' : '#38a169',
          color: '#fff', padding: '12px 24px', borderRadius: 8,
          fontSize: 14, fontWeight: 500, zIndex: 2000,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}>{toast}</div>
      )}
    </div>
  );
}
