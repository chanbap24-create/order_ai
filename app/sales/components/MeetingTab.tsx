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
  reminder_minutes: number | null;
  is_company_event?: boolean;
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
  meeting: { label: '회의', color: '#607D8B' },
  other: { label: '기타', color: '#795548' },
  company: { label: '회사일정', color: '#D4A017' },
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

const REMINDER_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: '기본값(30분)' },
  { value: 0, label: '없음' },
  { value: 5, label: '5분 전' },
  { value: 10, label: '10분 전' },
  { value: 15, label: '15분 전' },
  { value: 30, label: '30분 전' },
  { value: 60, label: '1시간 전' },
];

const DEFAULT_REMINDER_MINUTES = 30;

function buildGoogleCalendarUrl(meeting: Meeting): string {
  const base = 'https://calendar.google.com/calendar/render?action=TEMPLATE';
  const mt = MEETING_TYPES[meeting.meeting_type] || MEETING_TYPES.visit;
  const title = `[${mt.label}] ${meeting.client_name}`;

  let dates: string;
  const dateOnly = meeting.meeting_date.slice(0, 10).replace(/-/g, '');
  if (meeting.meeting_time) {
    const timeStr = meeting.meeting_time.replace(/:/g, '');
    const startDT = `${dateOnly}T${timeStr}00`;
    // +1시간
    const [hh, mm] = meeting.meeting_time.split(':').map(Number);
    const endH = hh + 1;
    const endDT = `${dateOnly}T${String(endH).padStart(2, '0')}${String(mm).padStart(2, '0')}00`;
    dates = `${startDT}/${endDT}`;
  } else {
    // 종일 이벤트: yyyyMMdd/yyyyMMdd+1
    const d = new Date(meeting.meeting_date + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    const nextDate = d.toISOString().slice(0, 10).replace(/-/g, '');
    dates = `${dateOnly}/${nextDate}`;
  }

  const details = [
    meeting.purpose && `목적: ${meeting.purpose}`,
    `타입: ${mt.label}`,
    `상태: ${STATUS_MAP[meeting.status]?.label || meeting.status}`,
  ].filter(Boolean).join('\n');

  const params = new URLSearchParams();
  params.set('action', 'TEMPLATE');
  params.set('text', title);
  params.set('dates', dates);
  params.set('details', details);
  params.set('location', meeting.client_name);

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function fmt(n: number) {
  if (n >= 1e8) return (n / 1e8).toFixed(1) + '억';
  if (n >= 1e4) return Math.round(n / 1e4).toLocaleString() + '만';
  return n.toLocaleString();
}

function getWeekRange(baseDate: Date): { start: Date; end: Date } {
  const d = new Date(baseDate);
  const day = d.getDay();
  const start = new Date(d);
  start.setDate(d.getDate() - day); // 일요일
  const end = new Date(start);
  end.setDate(start.getDate() + 6); // 토요일
  return { start, end };
}

function getMonthRange(baseDate: Date): { start: Date; end: Date } {
  const start = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  const end = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0);
  return { start, end };
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateKR(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}(${DAYS_KR[d.getDay()]})`;
}

export default function MeetingTab({ currentManager, isAdmin }: { currentManager: string; isAdmin: boolean }) {
  // ── 상태 ──
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'week' | 'month'>('month');
  const [weekBase, setWeekBase] = useState(new Date());
  const [filterManager, setFilterManager] = useState(isAdmin ? '' : currentManager);
  const [managers, setManagers] = useState<string[]>([]);
  const [holidays, setHolidays] = useState<Record<string, string>>({});

  // 생성 모달
  const [showModal, setShowModal] = useState(false);
  const [modalDate, setModalDate] = useState('');
  const [modalTime, setModalTime] = useState('10:00');
  const [modalType, setModalType] = useState('visit');
  const [modalTitle, setModalTitle] = useState('');
  const [modalPurpose, setModalPurpose] = useState('');
  const [modalClient, setModalClient] = useState<ClientOption | null>(null);
  const [modalClientSearch, setModalClientSearch] = useState('');
  const [modalClientOptions, setModalClientOptions] = useState<ClientOption[]>([]);
  const [modalShowDropdown, setModalShowDropdown] = useState(false);
  const [modalSaving, setModalSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [newClientMode, setNewClientMode] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientCode, setNewClientCode] = useState('');
  const [newClientCodeError, setNewClientCodeError] = useState('');
  const [modalReminder, setModalReminder] = useState<number | null>(null);
  const modalDropdownRef = useRef<HTMLDivElement>(null);
  const allClientsCache = useRef<{ manager: string; clients: ClientOption[] }>({ manager: '', clients: [] });

  // 알림 관련
  const notifiedIdsRef = useRef<Set<number>>(new Set());
  const [reminderToast, setReminderToast] = useState<{ text: string; meetingId: number } | null>(null);

  // 상세 패널
  const [detailMeeting, setDetailMeeting] = useState<Meeting | null>(null);
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [selectedRecs, setSelectedRecs] = useState<Set<string>>(new Set());
  const [quoteLoading, setQuoteLoading] = useState(false);
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

  const DEFAULT_MEETING_COLS = [
    'country','brand','region','grape_varieties',
    'image_url','vintage','product_name',
    'supply_price','retail_price','discount_rate','discounted_price',
    'tasting_note','note',
  ];

  const [quoteCols, setQuoteCols] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('meeting_quote_columns');
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return DEFAULT_MEETING_COLS;
  });

  useEffect(() => {
    try { localStorage.setItem('meeting_quote_columns', JSON.stringify(quoteCols)); } catch {}
  }, [quoteCols]);

  const [detailNotes, setDetailNotes] = useState('');
  const [toast, setToast] = useState('');

  // ── 날짜 범위 ──
  const { start: weekStart, end: weekEnd } = viewMode === 'week'
    ? getWeekRange(weekBase)
    : getMonthRange(weekBase);
  const rangeLabel = viewMode === 'week'
    ? `${weekStart.getMonth() + 1}/${weekStart.getDate()} ~ ${weekEnd.getMonth() + 1}/${weekEnd.getDate()}`
    : `${weekBase.getFullYear()}년 ${weekBase.getMonth() + 1}월`;

  // ── 담당자 로드 — admin만 ──
  useEffect(() => {
    if (!isAdmin) return;
    fetch('/api/sales/clients/managers')
      .then(r => r.json())
      .then(d => { if (d.managers) setManagers(d.managers); })
      .catch(() => {});
  }, [isAdmin]);

  // ── 공휴일 로드 ──
  useEffect(() => {
    const year = weekBase.getFullYear();
    fetch(`/api/sales/holidays?year=${year}`)
      .then(r => r.json())
      .then(d => { if (d.holidays) setHolidays(prev => ({ ...prev, ...d.holidays })); })
      .catch(() => {});
  }, [weekBase.getFullYear()]);

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
      if (currentWeek.length > 0 && d.getDay() === 0) {
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

  // ── 거래처 목록 프리로드 (담당자별 1회) ──
  const loadAllClients = useCallback(async (mgr: string) => {
    if (allClientsCache.current.manager === mgr && allClientsCache.current.clients.length > 0) return;
    try {
      const params = new URLSearchParams({ limit: '500', type: 'wine' });
      if (mgr) params.set('manager', mgr);
      const res = await fetch(`/api/sales/clients?${params}`);
      const json = await res.json();
      allClientsCache.current = { manager: mgr, clients: json.clients || [] };
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadAllClients(filterManager); }, [filterManager, loadAllClients]);

  // ── 거래처 검색 (로컬 필터링) ──
  useEffect(() => {
    if (modalClientSearch.length >= 1) {
      const q = modalClientSearch.toLowerCase();
      const filtered = allClientsCache.current.clients.filter(c =>
        c.client_name.toLowerCase().includes(q) || c.client_code.toLowerCase().includes(q)
      ).slice(0, 30);
      setModalClientOptions(filtered);
      setModalShowDropdown(true);
    } else {
      setModalClientOptions([]);
      setModalShowDropdown(false);
    }
  }, [modalClientSearch]);

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

  // ── 브라우저 알림 권한 요청 ──
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // ── 리마인더 폴링 (60초) ──
  useEffect(() => {
    const checkReminders = () => {
      const now = new Date();
      const todayStr = formatDate(now);
      const defaultMin = DEFAULT_REMINDER_MINUTES;

      for (const m of meetings) {
        if (m.meeting_date?.slice(0, 10) !== todayStr) continue;
        if (!m.meeting_time) continue;
        if (m.status === 'completed' || m.status === 'cancelled') continue;

        const reminderMin = m.reminder_minutes !== null && m.reminder_minutes !== undefined ? m.reminder_minutes : defaultMin;
        if (reminderMin === 0) continue;
        if (notifiedIdsRef.current.has(m.id)) continue;

        const [hh, mm] = m.meeting_time.split(':').map(Number);
        const meetingTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0);
        const alertTime = new Date(meetingTime.getTime() - reminderMin * 60 * 1000);

        if (now >= alertTime && now < meetingTime) {
          notifiedIdsRef.current.add(m.id);
          const mt = MEETING_TYPES[m.meeting_type] || MEETING_TYPES.visit;
          const title = `🔔 ${mt.label} · ${m.client_name}`;
          const body = `${m.meeting_time} · ${m.purpose || ''}`;

          // 브라우저 알림
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            const n = new Notification(title, { body, icon: '/favicon.ico' });
            n.onclick = () => {
              window.focus();
              openDetail(m);
            };
          }

          // 인앱 토스트
          setReminderToast({ text: `🔔 ${m.meeting_time} ${mt.label} - ${m.client_name}`, meetingId: m.id });
        }
      }
    };

    checkReminders();
    const interval = setInterval(checkReminders, 60000);
    return () => clearInterval(interval);
  }, [meetings]);

  // ── 미팅 생성/수정 ──
  const openCreateModal = (date?: string) => {
    setEditingId(null);
    setModalDate(date || formatDate(new Date()));
    setModalTime('10:00');
    setModalType('visit');
    setModalTitle('');
    setModalPurpose('');
    setModalClient(null);
    setModalClientSearch('');
    setNewClientMode(false);
    setNewClientName('');
    setNewClientCode('');
    setModalReminder(null);
    setShowModal(true);
  };

  const saveMeeting = async () => {
    let clientToUse = modalClient;

    // 신규 거래처 모드: 먼저 client_details에 등록
    if (newClientMode) {
      if (!newClientName.trim()) { setToast('거래처명을 입력해주세요.'); return; }
      const code = newClientCode.trim() || `NEW_${Date.now()}`;
      setModalSaving(true);
      try {
        const createRes = await fetch('/api/sales/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_code: code,
            client_name: newClientName.trim(),
            client_type: 'wine',
            manager: currentManager || '',
          }),
        });
        const createJson = await createRes.json();
        if (createJson.error) { setToast('거래처 등록 실패: ' + createJson.error); setModalSaving(false); return; }
        clientToUse = { client_code: code, client_name: newClientName.trim() };
      } catch {
        setToast('거래처 등록에 실패했습니다.'); setModalSaving(false); return;
      }
    }

    setModalSaving(true);
    try {
      const purposeStr = [modalTitle.trim(), modalPurpose.trim()].filter(Boolean).join(' - ') || null;
      const body: any = {
        client_code: clientToUse?.client_code || null,
        meeting_date: modalDate,
        meeting_time: modalTime,
        meeting_type: modalType,
        purpose: purposeStr,
        reminder_minutes: modalReminder,
        manager: currentManager || '',
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
      // 신규 생성 시 구글 캘린더 자동 열기
      if (!editingId) {
        const calUrl = buildGoogleCalendarUrl({
          meeting_date: modalDate,
          meeting_time: modalTime,
          meeting_type: modalType,
          purpose: purposeStr,
          status: 'planned',
          client_name: clientToUse?.client_name || modalTitle.trim() || '일정',
        } as Meeting);
        window.open(calUrl, '_blank');
      }
      setToast(editingId ? '미팅이 수정되었습니다.' : '미팅이 생성되었습니다.');
      loadMeetings();
    } catch {
      setToast('저장에 실패했습니다.');
    } finally {
      setModalSaving(false);
    }
  };

  // ── 미팅 수정 모달 열기 ──
  const openEditModal = (m: Meeting) => {
    setEditingId(m.id);
    setModalDate(m.meeting_date?.slice(0, 10) || formatDate(new Date()));
    setModalTime(m.meeting_time || '10:00');
    setModalType(m.meeting_type || 'visit');
    const parts = (m.purpose || '').split(' - ');
    setModalTitle(parts[0] || '');
    setModalPurpose(parts.slice(1).join(' - ') || '');
    setModalClient(m.client_code ? { client_code: m.client_code, client_name: m.client_name } : null);
    setModalClientSearch(m.client_name || '');
    setNewClientMode(false);
    setNewClientName('');
    setNewClientCode('');
    setModalReminder(m.reminder_minutes ?? null);
    setDetailMeeting(null);
    setShowModal(true);
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
      const params = new URLSearchParams();
      params.set('columns', JSON.stringify(quoteCols));
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
        marginBottom: 16, boxShadow: '0 2px 8px rgba(90,21,21,0.03)',
        border: '1px solid rgba(90,21,21,0.06)',
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
              boxShadow: viewMode === mode ? '0 1px 3px rgba(90,21,21,0.05)' : 'none',
              transition: 'all 0.2s',
            }}>
              {mode === 'week' ? '주간' : '월간'}
            </button>
          ))}
        </div>

        {isAdmin && managers.length > 0 && (
          <select
            value={filterManager}
            onChange={e => setFilterManager(e.target.value)}
            style={{
              padding: '8px 12px', borderRadius: 6, border: '1px solid rgba(90,21,21,0.08)',
              fontSize: 16, background: '#fff', color: filterManager ? '#2c1810' : '#999',
              outline: 'none', width: '100%', marginBottom: 12, boxSizing: 'border-box',
            }}
          >
            <option value="">전체 담당자</option>
            {managers.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={prevPeriod} style={{
            background: 'none', border: '1px solid rgba(90,21,21,0.08)', borderRadius: 6,
            padding: '6px 12px', cursor: 'pointer', fontSize: 14, color: '#8a8580',
          }}>←</button>
          <div style={{ textAlign: 'center' }}>
            <button onClick={goToday} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 15, fontWeight: 700, color: '#2c1810',
            }}>{rangeLabel}</button>
            {viewMode === 'week' && <div style={{ fontSize: 11, color: '#a8a098' }}>{weekStart.getFullYear()}</div>}
          </div>
          <button onClick={nextPeriod} style={{
            background: 'none', border: '1px solid rgba(90,21,21,0.08)', borderRadius: 6,
            padding: '6px 12px', cursor: 'pointer', fontSize: 14, color: '#8a8580',
          }}>→</button>
        </div>
      </div>

      {/* ── 미팅 리스트 ── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#a8a098' }}>로딩 중...</div>
      ) : viewMode === 'month' ? (
        /* ── 월간 뷰: 캘린더 그리드 ── */
        <div style={{
          background: '#fff', borderRadius: 12,
          border: '1px solid rgba(90,21,21,0.06)',
          boxShadow: '0 1px 3px rgba(90,21,21,0.03)',
          overflow: 'hidden',
        }}>
          {/* 요일 헤더 */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
            borderBottom: '1px solid rgba(90,21,21,0.06)', background: '#faf8f2',
          }}>
            {DAYS_KR.map(day => (
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
              borderBottom: wi < weekGroups.length - 1 ? '1px solid rgba(90,21,21,0.06)' : 'none',
            }}>
              {/* 첫 주 빈칸 채우기 */}
              {wi === 0 && (() => {
                const firstDay = new Date(week[0] + 'T00:00:00').getDay();
                const emptyCount = firstDay; // 일=0, 월=1 ... 토=6
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
                const holidayName = holidays[dateStr];
                const isHoliday = !!holidayName;

                return (
                  <div key={dateStr} style={{
                    borderRight: '1px solid #f8f6f0',
                    minHeight: 102, padding: '4px',
                    background: isToday ? '#faf0f2' : isHoliday ? '#fff5f5' : isPast ? '#fdfcfa' : '#fff',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    minWidth: 0,
                  }} onClick={() => openCreateModal(dateStr)}>
                    <div style={{
                      fontSize: 12, fontWeight: isToday ? 800 : 500,
                      color: isToday ? '#fff' : (isSun || isHoliday) ? '#c62828' : isSat ? '#1565C0' : isPast ? '#bbb' : '#2c1810',
                      textAlign: 'center', marginBottom: 2,
                      ...(isToday ? {
                        background: '#5A1515', borderRadius: '50%',
                        width: 22, height: 22, lineHeight: '22px',
                        margin: '0 auto 2px',
                      } : {}),
                    }}>{dayNum}</div>
                    {isHoliday && (
                      <div style={{
                        fontSize: 8, color: '#c62828', textAlign: 'center',
                        fontWeight: 600, lineHeight: 1.1, marginBottom: 1,
                        overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                      }}>{holidayName}</div>
                    )}

                    {dayMeetings.slice(0, 3).map(m => {
                      const mt = MEETING_TYPES[m.meeting_type] || MEETING_TYPES.visit;
                      const hasReminder = m.meeting_time && m.reminder_minutes !== 0;
                      return (
                        <div key={m.id} onClick={e => { e.stopPropagation(); openDetail(m); }} style={{
                          fontSize: 9, padding: '1px 3px', marginBottom: 1,
                          borderRadius: 3, overflow: 'hidden',
                          whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                          background: `${mt.color}18`, color: mt.color,
                          fontWeight: 600, cursor: 'pointer',
                          maxWidth: '100%',
                        }}>
                          {hasReminder && <span style={{ fontSize: 8, marginRight: 1 }}>🔔</span>}{m.meeting_time?.slice(0, 5) || ''} {m.client_name}
                        </div>
                      );
                    })}
                    {dayMeetings.length > 3 && (
                      <div style={{ fontSize: 9, color: '#a8a098', textAlign: 'center' }}>
                        +{dayMeetings.length - 3}건
                      </div>
                    )}
                  </div>
                );
              })}

              {/* 마지막 주 빈칸 채우기 */}
              {wi === weekGroups.length - 1 && (() => {
                const lastDay = new Date(week[week.length - 1] + 'T00:00:00').getDay();
                const emptyCount = 6 - lastDay; // 토=6이면 0, 일=0이면 6
                return Array.from({ length: emptyCount }).map((_, i) => (
                  <div key={`le${i}`} style={{ borderRight: '1px solid #f8f6f0', minHeight: 102, background: '#fcfcfb' }} />
                ));
              })()}
            </div>
          ))}

          {/* 월간 요약 */}
          <div style={{
            padding: '10px 14px', background: '#faf8f2', borderTop: '1px solid rgba(90,21,21,0.06)',
            fontSize: 12, color: '#8a8580', display: 'flex', justifyContent: 'space-between',
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
            const holidayName = holidays[dateStr];
            const isHoliday = !!holidayName;

            return (
              <div key={dateStr} style={{
                background: '#fff', borderRadius: 12,
                border: isToday ? '2px solid #5A1515' : isHoliday ? '1px solid #ffcdd2' : '1px solid rgba(90,21,21,0.06)',
                boxShadow: isToday ? '0 2px 8px rgba(90,21,21,0.12)' : '0 1px 3px rgba(90,21,21,0.03)',
                overflow: 'hidden',
              }}>
                {/* 날짜 헤더 */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 14px',
                  background: isToday ? '#faf0f2' : isHoliday ? '#fff5f5' : isPast ? '#fafafa' : '#fff',
                  borderBottom: '1px solid rgba(90,21,21,0.06)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      fontSize: 14, fontWeight: 700,
                      color: isToday ? '#5A1515' : isHoliday ? '#c62828' : isPast ? '#aaa' : '#2c1810',
                    }}>
                      {formatDateKR(dateStr)}
                    </span>
                    {isHoliday && (
                      <span style={{
                        fontSize: 10, padding: '2px 6px', borderRadius: 8,
                        background: '#ffebee', color: '#c62828', fontWeight: 600,
                      }}>{holidayName}</span>
                    )}
                    {isToday && (
                      <span style={{
                        fontSize: 10, padding: '2px 6px', borderRadius: 8,
                        background: '#5A1515', color: '#fff', fontWeight: 600,
                      }}>TODAY</span>
                    )}
                    {dayMeetings.length > 0 && (
                      <span style={{ fontSize: 11, color: '#a8a098' }}>{dayMeetings.length}건</span>
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
                      const hasReminder = m.meeting_time && m.reminder_minutes !== 0;

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
                            {hasReminder && <span style={{ fontSize: 10 }}>🔔</span>}{m.meeting_time || '--:--'}
                          </div>

                          {/* 내용 */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                              <span style={{ fontSize: 14, fontWeight: 600, color: '#2c1810' }}>
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
                                <span style={{ fontSize: 11, color: '#a8a098', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
            <div style={{ fontSize: 16, fontWeight: 700, color: '#2c1810', marginBottom: 20 }}>
              {editingId ? '일정 수정' : '일정 추가'}
            </div>

            {/* 제목 */}
            <label style={{ fontSize: 12, fontWeight: 600, color: '#8a8580', display: 'block', marginBottom: 6 }}>제목</label>
            <input
              type="text"
              placeholder="예: 주간 회의, 와인 시음회..."
              value={modalTitle}
              onChange={e => setModalTitle(e.target.value)}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8,
                border: '1px solid rgba(90,21,21,0.08)', fontSize: 16, outline: 'none',
                marginBottom: 14, boxSizing: 'border-box',
              }}
            />

            {/* 거래처 검색 (선택) */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#8a8580' }}>거래처 <span style={{ fontWeight: 400, color: '#bbb' }}>(선택)</span></label>
              <button
                onClick={() => {
                  setNewClientMode(!newClientMode);
                  setModalClient(null); setModalClientSearch('');
                  setNewClientName(''); setNewClientCode(''); setNewClientCodeError('');
                  setModalShowDropdown(false);
                }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 12, color: newClientMode ? '#dc3545' : '#5A1515', fontWeight: 600,
                }}
              >
                {newClientMode ? '기존 거래처 선택' : '+ 신규 거래처'}
              </button>
            </div>

            {newClientMode ? (
              <div style={{ marginBottom: 14 }}>
                <input
                  type="text"
                  placeholder="거래처명"
                  value={newClientName}
                  onChange={e => setNewClientName(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 8,
                    border: '1px solid rgba(90,21,21,0.08)', fontSize: 16, outline: 'none',
                    boxSizing: 'border-box', marginBottom: 8,
                  }}
                />
                <input
                  type="text"
                  placeholder="거래처 코드 (있으면 입력)"
                  value={newClientCode}
                  onChange={e => { setNewClientCode(e.target.value); setNewClientCodeError(''); }}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 8,
                    border: '1px solid rgba(90,21,21,0.08)', fontSize: 16, outline: 'none',
                    boxSizing: 'border-box', color: '#666',
                  }}
                />
                <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>
                  담당자: {currentManager || '-'} · 코드 없으면 자동 생성됩니다
                </div>
              </div>
            ) : (
              <div ref={modalDropdownRef} style={{ position: 'relative', marginBottom: 14 }}>
                <input
                  type="text"
                  placeholder="거래처명으로 검색..."
                  value={modalClientSearch}
                  onChange={e => { setModalClientSearch(e.target.value); setModalClient(null); }}
                  onFocus={() => { if (modalClientOptions.length > 0) setModalShowDropdown(true); }}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 8,
                    border: '1px solid rgba(90,21,21,0.08)', fontSize: 16, outline: 'none',
                    boxSizing: 'border-box', background: modalClient ? '#f8f6f0' : '#fff',
                  }}
                />
                {modalClient && (
                  <button onClick={() => { setModalClient(null); setModalClientSearch(''); }} style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#a8a098',
                  }}>×</button>
                )}
                {modalShowDropdown && modalClientOptions.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0,
                    background: '#fff', border: '1px solid rgba(90,21,21,0.08)',
                    borderRadius: '0 0 8px 8px', maxHeight: 200, overflowY: 'auto',
                    zIndex: 100, boxShadow: '0 4px 12px rgba(90,21,21,0.08)',
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
                        <div style={{ fontSize: 11, color: '#a8a098' }}>
                          {c.client_code}{c.manager && ` · ${c.manager}`}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 날짜 */}
            <label style={{ fontSize: 12, fontWeight: 600, color: '#8a8580', display: 'block', marginBottom: 6 }}>날짜</label>
            <input type="date" value={modalDate} onChange={e => setModalDate(e.target.value)} style={{
              width: '100%', padding: '10px 12px', borderRadius: 8,
              border: '1px solid rgba(90,21,21,0.08)', fontSize: 16, outline: 'none',
              marginBottom: 14, boxSizing: 'border-box',
            }} />

            {/* 시간 */}
            <label style={{ fontSize: 12, fontWeight: 600, color: '#8a8580', display: 'block', marginBottom: 6 }}>시간</label>
            <input type="time" value={modalTime} onChange={e => setModalTime(e.target.value)} style={{
              width: '100%', padding: '10px 12px', borderRadius: 8,
              border: '1px solid rgba(90,21,21,0.08)', fontSize: 16, outline: 'none',
              marginBottom: 14, boxSizing: 'border-box',
            }} />

            {/* 미팅 타입 */}
            <label style={{ fontSize: 12, fontWeight: 600, color: '#8a8580', display: 'block', marginBottom: 6 }}>미팅 타입</label>
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
            <label style={{ fontSize: 12, fontWeight: 600, color: '#8a8580', display: 'block', marginBottom: 6 }}>목적/메모</label>
            <textarea
              value={modalPurpose}
              onChange={e => setModalPurpose(e.target.value)}
              placeholder="미팅 목적..."
              rows={3}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8,
                border: '1px solid rgba(90,21,21,0.08)', fontSize: 16, outline: 'none',
                marginBottom: 14, boxSizing: 'border-box', resize: 'vertical',
                fontFamily: 'inherit',
              }}
            />

            {/* 알람 */}
            <label style={{ fontSize: 12, fontWeight: 600, color: '#8a8580', display: 'block', marginBottom: 6 }}>알람</label>
            <select
              value={modalReminder === null ? 'default' : String(modalReminder)}
              onChange={e => {
                const v = e.target.value;
                setModalReminder(v === 'default' ? null : Number(v));
              }}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8,
                border: '1px solid rgba(90,21,21,0.08)', fontSize: 16, outline: 'none',
                marginBottom: 20, boxSizing: 'border-box', background: '#fff',
                color: '#2c1810',
              }}
            >
              {REMINDER_OPTIONS.map(opt => (
                <option key={opt.value === null ? 'default' : opt.value} value={opt.value === null ? 'default' : opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* 버튼 */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowModal(false)} style={{
                flex: 1, padding: '12px', borderRadius: 8, border: '1px solid rgba(90,21,21,0.08)',
                background: '#fff', color: '#8a8580', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}>취소</button>
              <button onClick={saveMeeting} disabled={(newClientMode && !newClientName.trim()) || modalSaving} style={{
                flex: 1, padding: '12px', borderRadius: 8, border: 'none',
                background: ((newClientMode && !newClientName.trim()) || modalSaving) ? '#ccc' : 'linear-gradient(135deg, #5A1515, #8B2252)',
                color: '#fff', fontSize: 14, fontWeight: 600,
                cursor: ((newClientMode && !newClientName.trim()) || modalSaving) ? 'default' : 'pointer',
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

            {/* 상태 변경 (회사 일정은 읽기 전용) */}
            {detailMeeting.is_company_event ? (
              <div style={{
                padding: '10px 14px', borderRadius: 8, marginBottom: 16,
                background: '#FFF8E1', border: '1px solid #FFE082',
                fontSize: 12, color: '#F57F17', fontWeight: 600, textAlign: 'center',
              }}>
                회사 일정 (읽기 전용)
              </div>
            ) : (
            <div style={{
              display: 'flex', gap: 8, marginBottom: 16,
            }}>
              {STATUS_FLOW.map(s => {
                const sm = STATUS_MAP[s];
                const isCurrent = detailMeeting.status === s;
                return (
                  <button key={s} onClick={() => !isCurrent && changeStatus(detailMeeting, s)} style={{
                    flex: 1, padding: '8px', borderRadius: 8,
                    border: isCurrent ? `2px solid ${sm.color}` : '1px solid rgba(90,21,21,0.08)',
                    background: isCurrent ? sm.bg : '#fff',
                    color: isCurrent ? sm.color : '#999',
                    fontWeight: isCurrent ? 700 : 500,
                    fontSize: 12, cursor: isCurrent ? 'default' : 'pointer',
                  }}>{sm.label}</button>
                );
              })}
              <button onClick={() => openEditModal(detailMeeting)} style={{
                padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(90,21,21,0.15)',
                background: '#fff', color: '#5A1515', fontSize: 12, cursor: 'pointer', fontWeight: 600,
              }}>수정</button>
              <button onClick={() => deleteMeeting(detailMeeting.id)} style={{
                padding: '8px 12px', borderRadius: 8, border: '1px solid #ffcdd2',
                background: '#fff', color: '#c62828', fontSize: 12, cursor: 'pointer',
              }}>삭제</button>
            </div>
            )}

            {/* 구글 캘린더 추가 버튼 */}
            <button onClick={() => window.open(buildGoogleCalendarUrl(detailMeeting), '_blank')} style={{
              width: '100%', padding: '10px', borderRadius: 8, border: 'none',
              background: '#4285F4', color: '#fff', fontSize: 13, fontWeight: 600,
              marginBottom: 12, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="4" width="18" height="18" rx="2" stroke="#fff" strokeWidth="2"/>
                <path d="M3 10h18" stroke="#fff" strokeWidth="2"/>
                <path d="M8 2v4M16 2v4" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
                <rect x="7" y="13" width="4" height="4" rx="0.5" fill="#fff"/>
              </svg>
              캘린더에 추가
            </button>

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
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#2c1810', marginBottom: 10 }}>
                    거래처 매출 요약
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 12 }}>
                    <div>
                      <div style={{ color: '#a8a098', marginBottom: 2 }}>총 구매</div>
                      <div style={{ fontWeight: 700, color: '#2c1810' }}>{briefing.client_summary.total_purchases}건</div>
                    </div>
                    <div>
                      <div style={{ color: '#a8a098', marginBottom: 2 }}>평균 단가</div>
                      <div style={{ fontWeight: 700, color: '#2c1810' }}>{fmt(briefing.client_summary.avg_price)}원</div>
                    </div>
                    <div>
                      <div style={{ color: '#a8a098', marginBottom: 2 }}>최근 주문</div>
                      <div style={{ fontWeight: 700, color: '#2c1810' }}>{briefing.client_summary.last_order_date || '-'}</div>
                    </div>
                    <div>
                      <div style={{ color: '#a8a098', marginBottom: 2 }}>추세</div>
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
                    border: '1px solid rgba(90,21,21,0.06)',
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#2c1810', marginBottom: 10 }}>
                      최근 주문 내역
                    </div>
                    {briefing.recent_orders.map((o, i) => (
                      <div key={i} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '6px 0', borderBottom: i < briefing.recent_orders.length - 1 ? '1px solid #f5f3ed' : 'none',
                        fontSize: 12,
                      }}>
                        <span style={{ color: '#2c1810', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.item_name}</span>
                        <span style={{ color: '#a8a098', flexShrink: 0, marginLeft: 8 }}>{o.quantity}개 · {o.ship_date?.slice(5)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* 추천 와인 */}
                <div style={{
                  fontSize: 13, fontWeight: 700, color: '#2c1810', marginBottom: 8,
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
                        border: isSelected ? '2px solid #5A1515' : '1px solid rgba(90,21,21,0.06)',
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
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#2c1810', marginBottom: 3 }}>
                            <span style={{ color: r.score >= 20 ? '#c62828' : '#888', marginRight: 6, fontSize: 11 }}>{r.score}점</span>
                            {r.item_name}
                          </div>
                          {(r.country || r.grape) && (
                            <div style={{ fontSize: 11, color: '#8a8580', marginBottom: 2 }}>
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
                          <div style={{ fontWeight: 700, color: '#2c1810' }}>{r.price ? fmt(r.price) + '원' : '-'}</div>
                          <div style={{ color: '#a8a098', fontSize: 11 }}>재고 {r.stock}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 견적서 생성 버튼 */}
                {selectedRecs.size > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <div style={{ position: 'relative' }}>
                        <button
                          onClick={() => setShowColSettings(v => !v)}
                          style={{
                            width: 40, height: 40, borderRadius: 10, border: '1px solid #ddd',
                            background: showColSettings ? '#f5f0eb' : '#fff', color: '#5A1515',
                            fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                          title="컬럼 설정"
                        >⚙</button>
                        {showColSettings && (
                          <div style={{
                            position: 'absolute', bottom: 48, left: 0, background: '#fff',
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
                                onClick={() => setQuoteCols(DEFAULT_MEETING_COLS)}
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
                      <button onClick={createQuote} disabled={quoteLoading} style={{
                        flex: 1, padding: '14px', borderRadius: 10, border: 'none',
                        background: quoteLoading ? '#ccc' : 'linear-gradient(135deg, #5A1515, #8B2252)',
                        color: '#fff', fontSize: 14, fontWeight: 700,
                        cursor: quoteLoading ? 'default' : 'pointer',
                      }}>
                        {quoteLoading ? '생성 중...' : `선택 ${selectedRecs.size}개 → 견적서 생성 & 다운로드`}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 메모 */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#8a8580', display: 'block', marginBottom: 6 }}>메모</label>
              <textarea
                value={detailNotes}
                onChange={e => setDetailNotes(e.target.value)}
                placeholder="미팅 메모..."
                rows={3}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 8,
                  border: '1px solid rgba(90,21,21,0.08)', fontSize: 16, outline: 'none',
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

      {/* ── 알람 토스트 (자동 소멸 안 함) ── */}
      {reminderToast && (
        <div
          onClick={() => {
            const m = meetings.find(mt => mt.id === reminderToast.meetingId);
            if (m) openDetail(m);
            setReminderToast(null);
          }}
          style={{
            position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)',
            background: '#5A1515', color: '#fff', padding: '12px 20px', borderRadius: 10,
            fontSize: 14, fontWeight: 600, zIndex: 2100,
            boxShadow: '0 4px 16px rgba(90,21,21,0.3)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
            maxWidth: 'calc(100% - 32px)',
          }}
        >
          <span style={{ flex: 1 }}>{reminderToast.text}</span>
          <button
            onClick={e => { e.stopPropagation(); setReminderToast(null); }}
            style={{
              background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)',
              fontSize: 18, cursor: 'pointer', padding: '0 2px', lineHeight: 1,
            }}
          >×</button>
        </div>
      )}

      {/* ── 토스트 ── */}
      {toast && (
        <div style={{
          position: 'fixed', top: reminderToast ? 130 : 80, left: '50%', transform: 'translateX(-50%)',
          background: toast.startsWith('오류') ? '#c53030' : '#38a169',
          color: '#fff', padding: '12px 24px', borderRadius: 8,
          fontSize: 14, fontWeight: 500, zIndex: 2000,
          boxShadow: '0 4px 12px rgba(90,21,21,0.1)',
        }}>{toast}</div>
      )}
    </div>
  );
}
