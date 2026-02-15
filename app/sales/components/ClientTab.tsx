'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface ClientDetail {
  client_code: string;
  client_name: string;
  client_type: string;
  importance: number;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  address: string | null;
  business_type: string | null;
  manager: string | null;
  memo: string | null;
  visit_cycle_days: number;
  last_visit_date: string | null;
  next_visit_date: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

interface ClientStats {
  totalSales: number;
  lastShipDate: string | null;
  orderCount: number;
  recentHalf: number;
  prevHalf: number;
  changeRate: number;
}

const PAGE_SIZE = 30;

const IMPORTANCE_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'VIP', color: '#dc3545' },
  2: { label: '중요', color: '#fd7e14' },
  3: { label: '일반', color: '#6c757d' },
  4: { label: '간헐', color: '#adb5bd' },
  5: { label: '비활성', color: '#dee2e6' },
};

// CDV(Wine) 업종: on/off/etc 접두어
const BUSINESS_TYPES_WINE = [
  'on/업소', 'on/샵', 'on/도매장', 'on/호텔',
  'off/편의점', 'off/할인점', 'off/백화점',
  '백화점(와인)', '백화점(리빙)', 'etc/기타',
];
// DL(Glass) 업종
const BUSINESS_TYPES_GLASS = [
  '업소', '샵', '호텔', '기물벤더', '온라인',
  '수입사', '와인도매장', '기업특판',
  '백화점(와인)', '백화점(리빙)', '할인점', '리빙샵', '기타',
];
// 편집 드롭다운용 통합 목록
const BUSINESS_TYPES = [...new Set([...BUSINESS_TYPES_WINE, ...BUSINESS_TYPES_GLASS])];

interface GradeRule {
  vip_threshold: number;
  important_threshold: number;
  normal_threshold: number;
  occasional_threshold: number;
  listing_vip: number;
  listing_important: number;
  listing_normal: number;
  listing_occasional: number;
  listing_months: number;
}

interface GradeApplyResult {
  code: string;
  name?: string;
  sales: number;
  listings: number;
  oldGrade: number;
  newGrade: number;
  salesGrade: number;
  listingGrade: number;
  businessType: string;
}

function fmt(n: number) {
  if (n >= 1e8) return (n / 1e8).toFixed(1) + '억';
  if (n >= 1e4) return Math.round(n / 1e4) + '만';
  return n.toLocaleString();
}

function fmtThreshold(n: number) {
  if (n >= 1e8) return (n / 1e8) + '억';
  if (n >= 1e4) return (n / 1e4) + '만';
  return n.toLocaleString();
}

export default function ClientTab() {
  const [clientType, setClientType] = useState<'wine' | 'glass'>('wine');
  const [clients, setClients] = useState<ClientDetail[]>([]);
  const [stats, setStats] = useState<Record<string, ClientStats>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterImportance, setFilterImportance] = useState<number | null>(null);
  const [filterManager, setFilterManager] = useState('');
  const [managers, setManagers] = useState<string[]>([]);
  const [managersLoading, setManagersLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState<ClientDetail | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<Partial<ClientDetail>>({});
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [detailStats, setDetailStats] = useState<{
    totalSales: number;
    lastShipDate: string | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recentShipments: any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    itemStats: any[];
  } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const [statsLoading, setStatsLoading] = useState(true);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // 등급 기준 설정
  const [showGradeSettings, setShowGradeSettings] = useState(false);
  const [gradeBusinessType, setGradeBusinessType] = useState('_all');
  const [gradeRule, setGradeRule] = useState<GradeRule>({
    vip_threshold: 100000000,
    important_threshold: 50000000,
    normal_threshold: 10000000,
    occasional_threshold: 1000000,
    listing_vip: 15,
    listing_important: 10,
    listing_normal: 5,
    listing_occasional: 2,
    listing_months: 6,
  });
  const [gradeRuleLoading, setGradeRuleLoading] = useState(false);
  const [gradeRuleMatchType, setGradeRuleMatchType] = useState('');
  const [gradeRuleIsDefault, setGradeRuleIsDefault] = useState(true);
  const [gradeSaving, setGradeSaving] = useState(false);
  const [gradeApplying, setGradeApplying] = useState(false);
  const [gradeApplyResult, setGradeApplyResult] = useState<{
    updated: number;
    total: number;
    changes: GradeApplyResult[];
  } | null>(null);

  // 거래처 목록 조회 — 필터 state를 직접 의존
  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('type', clientType);
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (filterImportance) params.set('importance', String(filterImportance));
      if (filterManager) params.set('manager', filterManager);
      params.set('limit', '9999');

      const res = await fetch(`/api/sales/clients?${params}`);
      const json = await res.json();
      if (json.clients) {
        setClients(json.clients);
        setDisplayCount(PAGE_SIZE);
      }
    } catch (err) {
      console.error('Failed to fetch clients:', err);
    } finally {
      setLoading(false);
    }
  }, [clientType, debouncedSearch, filterImportance, filterManager]);

  // 담당자 목록은 shipments에서 직접 조회 (정확한 담당자 목록)
  const fetchManagers = useCallback(async () => {
    setManagersLoading(true);
    try {
      const table = clientType === 'glass' ? 'glass_shipments' : 'shipments';
      const res = await fetch(`/api/sales/clients/managers?table=${table}`);
      const json = await res.json();
      if (json.managers) {
        setManagers(json.managers);
      }
    } catch (err) {
      console.error('Failed to fetch managers:', err);
    } finally {
      setManagersLoading(false);
    }
  }, [clientType]);

  // 통계 조회 — 타입별
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await fetch(`/api/sales/clients/stats?type=${clientType}`);
      const json = await res.json();
      if (json.stats) setStats(json.stats);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, [clientType]);

  // 타입 변경 시 필터 초기화
  useEffect(() => {
    setFilterImportance(null);
    setFilterManager('');
    setSearch('');
    setDebouncedSearch('');
    setSelectedClient(null);
    setDisplayCount(PAGE_SIZE);
  }, [clientType]);

  // 필터 변경 시 자동 재조회
  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  // 타입 변경 시 담당자 목록 + 통계 재조회
  useEffect(() => {
    fetchManagers();
    fetchStats();
  }, [fetchManagers, fetchStats]);

  // 검색 디바운스
  const handleSearch = (value: string) => {
    setSearch(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(value), 300);
  };

  // 동기화 (clients → client_details)
  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch('/api/sales/clients/sync', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        setSyncResult(`${json.inserted}개 거래처 동기화 완료 (Wine: ${json.total_wine}, Glass: ${json.total_glass})`);
        fetchClients();
        fetchManagers();
        fetchStats();
      } else {
        setSyncResult('동기화 실패: ' + json.error);
      }
    } catch (err) {
      setSyncResult('동기화 오류: ' + (err instanceof Error ? err.message : 'Unknown'));
    } finally {
      setSyncing(false);
    }
  };

  // 거래처 상세 보기
  const openDetail = async (client: ClientDetail) => {
    setSelectedClient(client);
    setEditMode(false);
    setEditData({});
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/sales/clients/stats?code=${client.client_code}`);
      const json = await res.json();
      setDetailStats(json);
    } catch {
      setDetailStats(null);
    } finally {
      setDetailLoading(false);
    }
  };

  // 편집 저장
  const handleSave = async () => {
    if (!selectedClient) return;
    try {
      const res = await fetch('/api/sales/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_code: selectedClient.client_code, ...editData }),
      });
      const json = await res.json();
      if (json.success) {
        setSelectedClient({ ...selectedClient, ...editData } as ClientDetail);
        setEditMode(false);
        setEditData({});
        fetchClients();
      }
    } catch (err) {
      console.error('Save error:', err);
    }
  };

  // 중요도 빠른 변경
  const quickSetImportance = async (code: string, importance: number) => {
    try {
      await fetch('/api/sales/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_code: code, importance }),
      });
      setClients(prev => prev.map(c => c.client_code === code ? { ...c, importance } : c));
      if (selectedClient?.client_code === code) {
        setSelectedClient({ ...selectedClient, importance });
      }
    } catch (err) {
      console.error('Importance update error:', err);
    }
  };

  // 등급 기준 조회
  const fetchGradeRule = useCallback(async (manager: string, bizType: string) => {
    setGradeRuleLoading(true);
    setGradeApplyResult(null);
    try {
      const params = new URLSearchParams({
        manager,
        type: clientType,
        business_type: bizType,
      });
      const res = await fetch(`/api/sales/grade-rules?${params}`);
      const json = await res.json();
      if (json.rule) {
        setGradeRule({
          vip_threshold: json.rule.vip_threshold,
          important_threshold: json.rule.important_threshold,
          normal_threshold: json.rule.normal_threshold,
          occasional_threshold: json.rule.occasional_threshold,
          listing_vip: json.rule.listing_vip ?? 15,
          listing_important: json.rule.listing_important ?? 10,
          listing_normal: json.rule.listing_normal ?? 5,
          listing_occasional: json.rule.listing_occasional ?? 2,
          listing_months: json.rule.listing_months ?? 6,
        });
        setGradeRuleIsDefault(!!json.isDefault);
        setGradeRuleMatchType(json.matchType || '');
      }
    } catch (err) {
      console.error('Failed to fetch grade rule:', err);
    } finally {
      setGradeRuleLoading(false);
    }
  }, [clientType]);

  // 등급 기준 저장
  const saveGradeRule = async () => {
    if (!filterManager) return;
    setGradeSaving(true);
    try {
      const res = await fetch('/api/sales/grade-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manager: filterManager,
          client_type: clientType,
          business_type: gradeBusinessType,
          ...gradeRule,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setGradeRuleIsDefault(false);
        setGradeRuleMatchType('exact');
      }
    } catch (err) {
      console.error('Failed to save grade rule:', err);
    } finally {
      setGradeSaving(false);
    }
  };

  // 등급 자동 적용
  const applyGradeRule = async () => {
    if (!filterManager) return;
    setGradeApplying(true);
    setGradeApplyResult(null);
    try {
      // 먼저 기준 저장
      await saveGradeRule();

      const res = await fetch('/api/sales/grade-rules/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manager: filterManager,
          client_type: clientType,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setGradeApplyResult({
          updated: json.updated,
          total: json.total,
          changes: json.changes || [],
        });
        // 목록 새로고침
        fetchClients();
      }
    } catch (err) {
      console.error('Failed to apply grade rule:', err);
    } finally {
      setGradeApplying(false);
    }
  };

  // 등급 설정 열 때 현재 담당+업종 기준 조회
  useEffect(() => {
    if (showGradeSettings && filterManager) {
      fetchGradeRule(filterManager, gradeBusinessType);
    }
  }, [showGradeSettings, filterManager, gradeBusinessType, fetchGradeRule]);

  // ── 상세 패널 ──
  if (selectedClient) {
    const c = selectedClient;
    const imp = IMPORTANCE_LABELS[c.importance] || IMPORTANCE_LABELS[3];
    return (
      <div>
        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button
            onClick={() => setSelectedClient(null)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: 4, color: '#666', display: 'flex',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: '#1a1a2e' }}>{c.client_name}</span>
              <span style={{
                fontSize: 11, fontWeight: 600, color: imp.color,
                background: imp.color + '15', padding: '2px 8px', borderRadius: 4,
              }}>
                {imp.label}
              </span>
              <span style={{ fontSize: 12, color: '#999' }}>{c.client_code}</span>
            </div>
            <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
              {c.client_type === 'glass' ? 'Glass(DL)' : 'Wine(CDV)'}
              {c.manager && ` · 담당: ${c.manager}`}
              {c.business_type && ` · ${c.business_type}`}
            </div>
          </div>
          <button
            onClick={() => { setEditMode(!editMode); setEditData({}); }}
            style={{
              padding: '6px 16px', borderRadius: 6, border: '1px solid #ddd',
              background: editMode ? '#5A1515' : 'white',
              color: editMode ? 'white' : '#666',
              fontSize: 13, fontWeight: 500, cursor: 'pointer',
            }}
          >
            {editMode ? '취소' : '편집'}
          </button>
        </div>

        {/* 중요도 선택 */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
          {[1, 2, 3, 4, 5].map(n => {
            const info = IMPORTANCE_LABELS[n];
            const isActive = c.importance === n;
            return (
              <button
                key={n}
                onClick={() => quickSetImportance(c.client_code, n)}
                style={{
                  padding: '4px 12px', borderRadius: 4,
                  border: `1px solid ${isActive ? info.color : '#eee'}`,
                  background: isActive ? info.color + '15' : 'white',
                  color: isActive ? info.color : '#999',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}
              >
                {info.label}
              </button>
            );
          })}
        </div>

        {/* 연락처 정보 */}
        <div style={{
          background: 'white', borderRadius: 8, padding: 20,
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 16,
        }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e', marginBottom: 12 }}>연락처 정보</div>
          {editMode ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {renderEditField('담당자', 'contact_name', c.contact_name)}
              {renderEditField('전화번호', 'contact_phone', c.contact_phone)}
              {renderEditField('이메일', 'contact_email', c.contact_email)}
              {renderEditField('주소', 'address', c.address)}
              <div>
                <label style={{ fontSize: 11, color: '#999', display: 'block', marginBottom: 4 }}>업종</label>
                <select
                  value={editData.business_type ?? c.business_type ?? ''}
                  onChange={e => setEditData({ ...editData, business_type: e.target.value })}
                  style={{
                    width: '100%', padding: '8px 10px', borderRadius: 6,
                    border: '1px solid #ddd', fontSize: 14, background: 'white',
                  }}
                >
                  <option value="">선택</option>
                  {BUSINESS_TYPES.map(bt => <option key={bt} value={bt}>{bt}</option>)}
                </select>
              </div>
              {renderEditField('담당자(우리)', 'manager', c.manager)}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: 11, color: '#999', display: 'block', marginBottom: 4 }}>메모</label>
                <textarea
                  value={editData.memo ?? c.memo ?? ''}
                  onChange={e => setEditData({ ...editData, memo: e.target.value })}
                  rows={3}
                  style={{
                    width: '100%', padding: '8px 10px', borderRadius: 6,
                    border: '1px solid #ddd', fontSize: 14, resize: 'vertical',
                  }}
                />
              </div>
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  onClick={handleSave}
                  style={{
                    padding: '8px 24px', borderRadius: 6, border: 'none',
                    background: '#5A1515', color: 'white', fontSize: 13,
                    fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  저장
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px' }}>
              {renderInfoField('담당자', c.contact_name)}
              {renderInfoField('전화번호', c.contact_phone)}
              {renderInfoField('이메일', c.contact_email)}
              {renderInfoField('주소', c.address)}
              {renderInfoField('업종', c.business_type)}
              {renderInfoField('담당자(우리)', c.manager)}
              <div style={{ gridColumn: '1 / -1' }}>
                {renderInfoField('메모', c.memo)}
              </div>
            </div>
          )}
        </div>

        {/* 매출 요약 */}
        <div style={{
          background: 'white', borderRadius: 8, padding: 20,
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 16,
        }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e', marginBottom: 12 }}>매출 현황 (최근 1년)</div>
          {detailLoading ? (
            <div style={{ color: '#999', fontSize: 13 }}>로딩 중...</div>
          ) : detailStats ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
                <div style={{ textAlign: 'center', padding: '12px 0', background: '#f8f7f5', borderRadius: 6 }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#5A1515' }}>{fmt(detailStats.totalSales)}</div>
                  <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>총 매출</div>
                </div>
                <div style={{ textAlign: 'center', padding: '12px 0', background: '#f8f7f5', borderRadius: 6 }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1a2e' }}>{detailStats.itemStats?.length || 0}</div>
                  <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>구매 품목 수</div>
                </div>
                <div style={{ textAlign: 'center', padding: '12px 0', background: '#f8f7f5', borderRadius: 6 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e' }}>{detailStats.lastShipDate || '-'}</div>
                  <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>최근 출고일</div>
                </div>
              </div>

              {/* 주요 구매 품목 */}
              {detailStats.itemStats && detailStats.itemStats.length > 0 && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', marginBottom: 8 }}>주요 구매 품목</div>
                  <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                    {detailStats.itemStats.slice(0, 10).map((item: { item_no: string; item_name: string; buy_count: number; avg_price: number; last_ship_date: string }) => (
                      <div key={item.item_no} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '6px 0', borderBottom: '1px solid #f0f0f0',
                        fontSize: 13,
                      }}>
                        <span style={{ flex: 1, color: '#333' }}>{item.item_name}</span>
                        <span style={{ color: '#999', fontSize: 12 }}>{item.buy_count}회</span>
                        <span style={{ color: '#5A1515', fontWeight: 600, fontSize: 12 }}>
                          {item.avg_price ? fmt(item.avg_price) : '-'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 최근 출고 */}
              {detailStats.recentShipments && detailStats.recentShipments.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', marginBottom: 8 }}>최근 출고</div>
                  <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                    {detailStats.recentShipments.slice(0, 10).map((s: { item_no: string; item_name: string; quantity: number; total_amount: number; ship_date: string }, i: number) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '6px 0', borderBottom: '1px solid #f0f0f0',
                        fontSize: 13,
                      }}>
                        <span style={{ fontSize: 11, color: '#aaa', width: 72 }}>{s.ship_date?.toString().slice(0, 10)}</span>
                        <span style={{ flex: 1, color: '#333' }}>{s.item_name}</span>
                        <span style={{ color: '#999', fontSize: 12 }}>{s.quantity}개</span>
                        <span style={{ color: '#5A1515', fontWeight: 600, fontSize: 12 }}>
                          {s.total_amount ? fmt(s.total_amount) : '-'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{ color: '#999', fontSize: 13 }}>출고 이력 없음</div>
          )}
        </div>

        {/* 태그 */}
        <div style={{
          background: 'white', borderRadius: 8, padding: 20,
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e', marginBottom: 12 }}>태그</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(c.tags || []).map((tag, i) => (
              <span key={i} style={{
                padding: '4px 10px', borderRadius: 12,
                background: '#f0ece6', color: '#5A1515',
                fontSize: 12, fontWeight: 500,
              }}>
                {tag}
              </span>
            ))}
            {(!c.tags || c.tags.length === 0) && (
              <span style={{ fontSize: 12, color: '#ccc' }}>태그 없음</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── 목록 뷰 ──
  return (
    <div>
      {/* CDV / DL 토글 */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 16 }}>
        {([['wine', 'CDV (Wine)'], ['glass', 'DL (Glass)']] as const).map(([type, label]) => {
          const active = clientType === type;
          return (
            <button
              key={type}
              onClick={() => setClientType(type)}
              style={{
                flex: 1,
                padding: '10px 0',
                border: 'none',
                borderBottom: `2px solid ${active ? '#5A1515' : '#eee'}`,
                background: active ? '#5A1515' + '08' : 'transparent',
                color: active ? '#5A1515' : '#999',
                fontSize: 14,
                fontWeight: active ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* 상단 바 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <input
            type="text"
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="거래처명, 코드, 담당자 검색..."
            style={{
              width: '100%', padding: '8px 12px', borderRadius: 6,
              border: '1px solid #ddd', fontSize: 14,
            }}
          />
        </div>

        {/* 중요도 필터 */}
        <select
          value={filterImportance ?? ''}
          onChange={e => {
            setFilterImportance(e.target.value ? parseInt(e.target.value) : null);
          }}
          style={{
            padding: '8px 12px', borderRadius: 6, border: '1px solid #ddd',
            fontSize: 13, background: 'white', color: '#666',
          }}
        >
          <option value="">전체 등급</option>
          {[1, 2, 3, 4, 5].map(n => (
            <option key={n} value={n}>{IMPORTANCE_LABELS[n].label}</option>
          ))}
        </select>

        {/* 담당자 필터 */}
        <select
          value={filterManager}
          onChange={e => {
            setFilterManager(e.target.value);
          }}
          style={{
            padding: '8px 12px', borderRadius: 6, border: '1px solid #ddd',
            fontSize: 13, background: 'white', color: '#666',
          }}
        >
          <option value="">{managersLoading ? '담당 로딩...' : '담당 선택'}</option>
          {managers.map(m => <option key={m} value={m}>{m}</option>)}
        </select>

        {/* 등급 기준 설정 버튼 */}
        {filterManager && (
          <button
            onClick={() => setShowGradeSettings(!showGradeSettings)}
            style={{
              padding: '8px 16px', borderRadius: 6,
              border: showGradeSettings ? 'none' : '1px solid #5A1515',
              background: showGradeSettings ? '#5A1515' : 'white',
              color: showGradeSettings ? 'white' : '#5A1515',
              fontSize: 13, fontWeight: 500, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            등급 기준
          </button>
        )}

        {/* 동기화 버튼 */}
        <button
          onClick={handleSync}
          disabled={syncing}
          style={{
            padding: '8px 16px', borderRadius: 6, border: '1px solid #5A1515',
            background: 'white', color: '#5A1515', fontSize: 13,
            fontWeight: 500, cursor: syncing ? 'wait' : 'pointer',
            opacity: syncing ? 0.6 : 1,
          }}
        >
          {syncing ? '동기화 중...' : '거래처 동기화'}
        </button>
      </div>

      {/* 동기화 결과 */}
      {syncResult && (
        <div style={{
          padding: '8px 12px', borderRadius: 6, marginBottom: 12,
          background: syncResult.includes('실패') || syncResult.includes('오류') ? '#fff3f3' : '#f0faf0',
          color: syncResult.includes('실패') || syncResult.includes('오류') ? '#dc3545' : '#28a745',
          fontSize: 13,
        }}>
          {syncResult}
        </div>
      )}

      {/* 등급 기준 설정 패널 */}
      {showGradeSettings && filterManager && (
        <div style={{
          background: 'white', borderRadius: 8, padding: 20,
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 16,
          border: '1px solid #e8e0d8',
        }}>
          {/* 헤더 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e' }}>
                등급 기준 설정
              </div>
              <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
                {filterManager} · {clientType === 'glass' ? 'Glass(DL)' : 'Wine(CDV)'}
                {gradeRuleIsDefault && (
                  <span style={{ color: '#fd7e14', marginLeft: 8 }}>
                    {gradeRuleMatchType === 'manager_all' ? '전체 업종 기준 적용 중' : '기본값 사용 중'}
                  </span>
                )}
                {!gradeRuleIsDefault && gradeBusinessType !== '_all' && (
                  <span style={{ color: '#28a745', marginLeft: 8 }}>
                    업종별 개별 설정
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => setShowGradeSettings(false)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: 4, color: '#999',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 업종 선택 */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: '#999', marginBottom: 6 }}>적용 업종</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {[
                { value: '_all', label: '전체 업종' },
                ...(clientType === 'glass' ? BUSINESS_TYPES_GLASS : BUSINESS_TYPES_WINE).map(bt => ({ value: bt, label: bt })),
              ].map(opt => {
                const active = gradeBusinessType === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setGradeBusinessType(opt.value)}
                    style={{
                      padding: '5px 12px', borderRadius: 4,
                      border: `1px solid ${active ? '#5A1515' : '#ddd'}`,
                      background: active ? '#5A151510' : 'white',
                      color: active ? '#5A1515' : '#888',
                      fontSize: 12, fontWeight: active ? 600 : 400,
                      cursor: 'pointer',
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {gradeRuleLoading ? (
            <div style={{ textAlign: 'center', padding: 20, color: '#999', fontSize: 13 }}>로딩 중...</div>
          ) : (
            <>
              {/* 매출 기준 */}
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', marginBottom: 8 }}>
                매출 기준 (연간)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, marginBottom: 16 }}>
                {([
                  { key: 'vip_threshold' as const, label: 'VIP', color: '#dc3545' },
                  { key: 'important_threshold' as const, label: '중요', color: '#fd7e14' },
                  { key: 'normal_threshold' as const, label: '일반', color: '#6c757d' },
                  { key: 'occasional_threshold' as const, label: '간헐', color: '#adb5bd' },
                ]).map(({ key, label, color }) => (
                  <div key={key} style={{
                    padding: '8px 12px', borderRadius: 6,
                    background: '#f8f7f5', borderLeft: `3px solid ${color}`,
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color, marginBottom: 4 }}>{label}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <input
                        type="number"
                        value={Math.round(gradeRule[key] / 10000)}
                        onFocus={e => e.target.select()}
                        onChange={e => {
                          const manWon = parseInt(e.target.value) || 0;
                          setGradeRule(prev => ({ ...prev, [key]: manWon * 10000 }));
                        }}
                        style={{
                          flex: 1, padding: '6px 8px', borderRadius: 4,
                          border: '1px solid #ddd', fontSize: 13, textAlign: 'right',
                          background: 'white', minWidth: 0,
                        }}
                      />
                      <span style={{ fontSize: 11, color: '#999', flexShrink: 0 }}>만원↑</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* 리스팅 기준 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>
                  활성 리스팅 기준
                </div>
                <div style={{
                  fontSize: 11, color: '#999', padding: '2px 8px',
                  background: '#f0ece6', borderRadius: 4,
                }}>
                  최근
                  <input
                    type="number"
                    value={gradeRule.listing_months}
                    onFocus={e => e.target.select()}
                    onChange={e => setGradeRule(prev => ({ ...prev, listing_months: parseInt(e.target.value) || 6 }))}
                    style={{
                      width: 32, padding: '2px 4px', borderRadius: 3,
                      border: '1px solid #ddd', fontSize: 11, textAlign: 'center',
                      margin: '0 4px', background: 'white',
                    }}
                  />
                  개월 내 발주 품목 수
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, marginBottom: 12 }}>
                {([
                  { key: 'listing_vip' as const, label: 'VIP', color: '#dc3545' },
                  { key: 'listing_important' as const, label: '중요', color: '#fd7e14' },
                  { key: 'listing_normal' as const, label: '일반', color: '#6c757d' },
                  { key: 'listing_occasional' as const, label: '간헐', color: '#adb5bd' },
                ]).map(({ key, label, color }) => (
                  <div key={key} style={{
                    padding: '8px 12px', borderRadius: 6,
                    background: '#f8f7f5', borderLeft: `3px solid ${color}`,
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color, marginBottom: 4 }}>{label}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <input
                        type="number"
                        value={gradeRule[key]}
                        onFocus={e => e.target.select()}
                        onChange={e => {
                          setGradeRule(prev => ({ ...prev, [key]: parseInt(e.target.value) || 0 }));
                        }}
                        style={{
                          flex: 1, padding: '6px 8px', borderRadius: 4,
                          border: '1px solid #ddd', fontSize: 13, textAlign: 'right',
                          background: 'white', minWidth: 0,
                        }}
                      />
                      <span style={{ fontSize: 11, color: '#999', flexShrink: 0 }}>품목↑</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* 판정 규칙 안내 */}
              <div style={{
                fontSize: 12, color: '#888', marginBottom: 16,
                padding: '8px 12px', background: '#f8f7f5', borderRadius: 6,
                lineHeight: 1.6,
              }}>
                <strong>판정 규칙:</strong> 매출 기준과 리스팅 기준 중 더 좋은 등급을 적용합니다.
                <br />예) 매출 3등급이지만 리스팅 15개 이상이면 → VIP 등급
                <br />5등급 (비활성): 매출 {fmtThreshold(gradeRule.occasional_threshold)}원 미만 & 리스팅 {gradeRule.listing_occasional}개 미만
              </div>

              {/* 빠른 설정 프리셋 */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: '#999', marginBottom: 6 }}>빠른 설정</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {([
                    { label: '기본 (CDV)', values: { vip_threshold: 100000000, important_threshold: 50000000, normal_threshold: 10000000, occasional_threshold: 1000000, listing_vip: 15, listing_important: 10, listing_normal: 5, listing_occasional: 2, listing_months: 6 } },
                    { label: '기본 (DL)', values: { vip_threshold: 50000000, important_threshold: 20000000, normal_threshold: 5000000, occasional_threshold: 500000, listing_vip: 10, listing_important: 7, listing_normal: 3, listing_occasional: 1, listing_months: 6 } },
                    { label: '대형 거래처', values: { vip_threshold: 300000000, important_threshold: 100000000, normal_threshold: 30000000, occasional_threshold: 5000000, listing_vip: 20, listing_important: 15, listing_normal: 8, listing_occasional: 3, listing_months: 6 } },
                    { label: '소형 거래처', values: { vip_threshold: 30000000, important_threshold: 10000000, normal_threshold: 3000000, occasional_threshold: 500000, listing_vip: 8, listing_important: 5, listing_normal: 3, listing_occasional: 1, listing_months: 6 } },
                  ]).map(preset => (
                    <button
                      key={preset.label}
                      onClick={() => setGradeRule(preset.values)}
                      style={{
                        padding: '4px 10px', borderRadius: 4,
                        border: '1px solid #ddd', background: 'white',
                        fontSize: 12, color: '#666', cursor: 'pointer',
                      }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 액션 버튼 */}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
                <button
                  onClick={saveGradeRule}
                  disabled={gradeSaving}
                  style={{
                    padding: '8px 20px', borderRadius: 6,
                    border: '1px solid #5A1515', background: 'white',
                    color: '#5A1515', fontSize: 13, fontWeight: 500,
                    cursor: gradeSaving ? 'wait' : 'pointer',
                    opacity: gradeSaving ? 0.6 : 1,
                  }}
                >
                  {gradeSaving ? '저장 중...' : '기준 저장'}
                </button>
                <button
                  onClick={applyGradeRule}
                  disabled={gradeApplying}
                  style={{
                    padding: '8px 20px', borderRadius: 6,
                    border: 'none', background: '#5A1515',
                    color: 'white', fontSize: 13, fontWeight: 600,
                    cursor: gradeApplying ? 'wait' : 'pointer',
                    opacity: gradeApplying ? 0.6 : 1,
                  }}
                >
                  {gradeApplying ? '적용 중...' : '등급 자동 적용'}
                </button>
              </div>

              {/* 적용 결과 */}
              {gradeApplyResult && (
                <div style={{
                  marginTop: 16, padding: 12, borderRadius: 6,
                  background: gradeApplyResult.updated > 0 ? '#f0faf0' : '#f8f7f5',
                  border: `1px solid ${gradeApplyResult.updated > 0 ? '#28a74530' : '#eee'}`,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', marginBottom: 8 }}>
                    {gradeApplyResult.total}개 거래처 중 {gradeApplyResult.updated}개 등급 변경
                  </div>
                  {gradeApplyResult.changes.length > 0 && (
                    <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                      {/* 헤더 */}
                      <div style={{
                        display: 'grid', gridTemplateColumns: '1fr 60px 36px 60px 12px 60px',
                        gap: 6, padding: '4px 0', borderBottom: '1px solid #ddd',
                        fontSize: 11, color: '#999', fontWeight: 600,
                      }}>
                        <span>거래처</span>
                        <span style={{ textAlign: 'right' }}>매출</span>
                        <span style={{ textAlign: 'right' }}>리스팅</span>
                        <span style={{ textAlign: 'center' }}>이전</span>
                        <span />
                        <span style={{ textAlign: 'center' }}>변경</span>
                      </div>
                      {gradeApplyResult.changes.map((ch, i) => (
                        <div key={i} style={{
                          display: 'grid', gridTemplateColumns: '1fr 60px 36px 60px 12px 60px',
                          gap: 6, padding: '5px 0', borderBottom: '1px solid #f0f0f0',
                          fontSize: 12, alignItems: 'center',
                        }}>
                          <span style={{ color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {ch.name || ch.code}
                          </span>
                          <span style={{ color: '#999', textAlign: 'right', fontSize: 11 }}>{fmt(ch.sales)}</span>
                          <span style={{ color: '#5A1515', textAlign: 'right', fontSize: 11, fontWeight: 600 }}>{ch.listings}</span>
                          <span style={{
                            textAlign: 'center', fontWeight: 600, fontSize: 11,
                            color: IMPORTANCE_LABELS[ch.oldGrade]?.color || '#999',
                          }}>
                            {IMPORTANCE_LABELS[ch.oldGrade]?.label || ch.oldGrade}
                          </span>
                          <span style={{ color: '#ccc', textAlign: 'center' }}>→</span>
                          <span style={{
                            textAlign: 'center', fontWeight: 600, fontSize: 11,
                            color: IMPORTANCE_LABELS[ch.newGrade]?.color || '#999',
                          }}>
                            {IMPORTANCE_LABELS[ch.newGrade]?.label || ch.newGrade}
                            {ch.listingGrade < ch.salesGrade && (
                              <span style={{ fontSize: 9, color: '#5A1515', marginLeft: 2 }} title="리스팅 기준 적용">L</span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {gradeApplyResult.updated === 0 && (
                    <div style={{ fontSize: 12, color: '#999' }}>
                      모든 거래처가 이미 올바른 등급입니다
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* 통계 요약 — 담당 선택 또는 검색 시에만 표시 */}
      {(filterManager || debouncedSearch) && <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
        gap: 8, marginBottom: 16,
      }}>
        {[1, 2, 3, 4, 5].map(n => {
          const count = clients.filter(c => c.importance === n).length;
          const info = IMPORTANCE_LABELS[n];
          return (
            <div key={n} style={{
              textAlign: 'center', padding: '8px 4px', borderRadius: 6,
              background: filterImportance === n ? info.color + '15' : '#f8f7f5',
              border: `1px solid ${filterImportance === n ? info.color + '40' : 'transparent'}`,
              cursor: 'pointer',
            }}
            onClick={() => {
              setFilterImportance(filterImportance === n ? null : n);
            }}
            >
              <div style={{ fontSize: 18, fontWeight: 700, color: info.color }}>{count}</div>
              <div style={{ fontSize: 11, color: '#999' }}>{info.label}</div>
            </div>
          );
        })}
      </div>}

      {/* 거래처 목록 — 매출순 정렬 */}
      {!filterManager && !debouncedSearch ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ddd" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 12 }}>
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <div style={{ fontSize: 14, color: '#999', fontWeight: 500 }}>담당자를 선택하면 거래처 목록이 표시됩니다</div>
          <div style={{ fontSize: 12, color: '#ccc', marginTop: 4 }}>검색으로도 조회할 수 있습니다</div>
        </div>
      ) : loading || statsLoading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>로딩 중...</div>
      ) : clients.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ color: '#ccc', fontSize: 14, marginBottom: 12 }}>
            등록된 거래처가 없습니다
          </div>
          <button
            onClick={handleSync}
            style={{
              padding: '10px 24px', borderRadius: 6, border: 'none',
              background: '#5A1515', color: 'white', fontSize: 14,
              fontWeight: 600, cursor: 'pointer',
            }}
          >
            기존 거래처 불러오기
          </button>
        </div>
      ) : (() => {
        // 매출순 정렬 (내림차순) — 현재 순위
        const sorted = [...clients].sort((a, b) => {
          const sa = stats[a.client_code]?.totalSales || 0;
          const sb = stats[b.client_code]?.totalSales || 0;
          return sb - sa;
        });

        // 이전 3개월 매출 기준 순위 (순위 변동 계산용)
        const prevSorted = [...clients].sort((a, b) => {
          const sa = stats[a.client_code]?.prevHalf || 0;
          const sb = stats[b.client_code]?.prevHalf || 0;
          return sb - sa;
        });
        const prevRankMap = new Map<string, number>();
        prevSorted.forEach((c, i) => prevRankMap.set(c.client_code, i + 1));

        const visible = sorted.slice(0, displayCount);
        const hasMore = displayCount < sorted.length;

        return (
          <>
            <div style={{ fontSize: 12, color: '#aaa', marginBottom: 8 }}>
              총 {sorted.length}개 거래처 · 매출순
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {visible.map((c, idx) => {
                const imp = IMPORTANCE_LABELS[c.importance] || IMPORTANCE_LABELS[3];
                const st = stats[c.client_code];
                const cr = st?.changeRate ?? 0;
                const crColor = cr > 0 ? '#28a745' : cr < 0 ? '#dc3545' : '#aaa';
                const crSign = cr > 0 ? '+' : '';

                // 순위 변동: 이전 순위 - 현재 순위 (양수=상승, 음수=하락)
                const currentRank = idx + 1;
                const prevRank = prevRankMap.get(c.client_code) || currentRank;
                const rankDiff = prevRank - currentRank;

                return (
                  <div
                    key={c.client_code}
                    onClick={() => openDetail(c)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 16px', borderRadius: 8,
                      background: 'white', cursor: 'pointer',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                      transition: 'box-shadow 0.15s ease',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.08)')}
                    onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)')}
                  >
                    {/* 순위 + 변동 */}
                    <div style={{
                      width: 32, textAlign: 'center', flexShrink: 0,
                    }}>
                      <div style={{
                        fontSize: 13, fontWeight: 700,
                        color: idx < 3 ? '#5A1515' : '#bbb',
                      }}>
                        {currentRank}
                      </div>
                      {rankDiff !== 0 && (
                        <div style={{
                          fontSize: 10, fontWeight: 600, lineHeight: 1,
                          color: rankDiff > 0 ? '#28a745' : '#dc3545',
                        }}>
                          {rankDiff > 0 ? `▲${rankDiff}` : `▼${Math.abs(rankDiff)}`}
                        </div>
                      )}
                      {rankDiff === 0 && st && (st.recentHalf > 0 || st.prevHalf > 0) && (
                        <div style={{ fontSize: 10, color: '#ccc', lineHeight: 1 }}>-</div>
                      )}
                    </div>

                    {/* 정보 */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{
                          fontSize: 9, fontWeight: 700, flexShrink: 0,
                          padding: '2px 6px', borderRadius: 3,
                          color: imp.color,
                          background: imp.color + '14',
                          border: `1px solid ${imp.color}25`,
                          lineHeight: 1.2,
                        }}>
                          {imp.label}
                        </span>
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.client_name}
                        </span>
                        <span style={{ fontSize: 11, color: '#bbb', flexShrink: 0 }}>{c.client_code}</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
                        {c.manager && <span>{c.manager}</span>}
                        {c.business_type && <span> · {c.business_type}</span>}
                        {st?.lastShipDate && <span> · 최근 {st.lastShipDate}</span>}
                      </div>
                    </div>

                    {/* 매출 + 변동률 */}
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      {st ? (
                        <>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#5A1515' }}>
                            {fmt(st.totalSales)}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                            <span style={{ fontSize: 11, color: '#aaa' }}>{st.orderCount}건</span>
                            {cr !== 0 && (
                              <span style={{
                                fontSize: 11, fontWeight: 600, color: crColor,
                              }}>
                                {crSign}{cr}%
                              </span>
                            )}
                          </div>
                        </>
                      ) : (
                        <div style={{ fontSize: 12, color: '#ddd' }}>-</div>
                      )}
                    </div>

                    {/* 화살표 */}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </div>
                );
              })}
            </div>

            {/* 더보기 버튼 */}
            {hasMore && (
              <button
                onClick={() => setDisplayCount(prev => prev + PAGE_SIZE)}
                style={{
                  width: '100%', padding: '12px 0', marginTop: 12,
                  borderRadius: 8, border: '1px solid #eee',
                  background: 'white', color: '#666',
                  fontSize: 13, fontWeight: 500, cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f8f7f5')}
                onMouseLeave={e => (e.currentTarget.style.background = 'white')}
              >
                더보기 ({Math.min(sorted.length - displayCount, PAGE_SIZE)}개 더) · 총 {sorted.length}개 중 {displayCount}개 표시
              </button>
            )}
          </>
        );
      })()}
    </div>
  );

  // ── 헬퍼 ──
  function renderInfoField(label: string, value: string | null | undefined) {
    return (
      <div>
        <div style={{ fontSize: 11, color: '#999', marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 14, color: value ? '#333' : '#ccc' }}>{value || '-'}</div>
      </div>
    );
  }

  function renderEditField(label: string, field: keyof ClientDetail, currentValue: string | null | undefined) {
    return (
      <div>
        <label style={{ fontSize: 11, color: '#999', display: 'block', marginBottom: 4 }}>{label}</label>
        <input
          type="text"
          value={(editData[field] as string) ?? currentValue ?? ''}
          onChange={e => setEditData({ ...editData, [field]: e.target.value })}
          style={{
            width: '100%', padding: '8px 10px', borderRadius: 6,
            border: '1px solid #ddd', fontSize: 14,
          }}
        />
      </div>
    );
  }
}
