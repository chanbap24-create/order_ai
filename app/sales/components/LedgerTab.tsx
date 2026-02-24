'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface LedgerRow {
  ship_date: string;
  item_no: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  supply_amount: number;
  tax_amount: number;
  total_amount: number;
  manager: string;
  warehouse: string;
}

interface ClientInfo {
  client_code: string;
  client_name: string;
  client_type?: string;
  manager?: string;
  importance?: number;
}

interface SuggestionItem { code: string; name: string; type?: string; }

// 월 키 추출 (YYYY-MM)
function monthKey(date: string) { return date.slice(0, 7); }
// 일 키 추출 (YYYY-MM-DD)
function dayKey(date: string) { return date.slice(0, 10); }

function fmt(n: number) { return n.toLocaleString(); }

export default function LedgerTab({ currentManager, isAdmin }: { currentManager: string; isAdmin: boolean }) {
  // 검색
  const [clientSearch, setClientSearch] = useState('');
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedClient, setSelectedClient] = useState<SuggestionItem | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // 기간
  const now = new Date();
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const today = now.toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate] = useState(today);

  // 타입
  const [type, setType] = useState<'wine' | 'glass'>('wine');

  // 결과
  const [loading, setLoading] = useState(false);
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [prevBalance, setPrevBalance] = useState(0);
  const [error, setError] = useState('');

  // 접기/펼치기
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(new Set());

  // 타입 변경 시 거래처 초기화
  const handleTypeChange = (t: 'wine' | 'glass') => {
    setType(t);
    setClientSearch('');
    setSelectedClient(null);
    setSuggestions([]);
  };

  // 거래처 검색
  const searchTimer = useRef<any>(null);
  const handleSearchChange = useCallback((val: string) => {
    setClientSearch(val);
    setSelectedClient(null);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (val.trim().length < 1) { setSuggestions([]); setShowSuggestions(false); return; }
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/sales/clients?search=${encodeURIComponent(val)}&limit=15&type=${type}`);
        const data = await res.json();
        if (data.clients) {
          setSuggestions(data.clients.map((c: any) => ({
            code: c.client_code, name: c.client_name, type: c.client_type,
          })));
          setShowSuggestions(true);
        }
      } catch { /* ignore */ }
    }, 300);
  }, [type]);

  // 외부 클릭 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // 거래처 선택
  const selectClient = (item: SuggestionItem) => {
    setSelectedClient(item);
    setClientSearch(item.name);
    setShowSuggestions(false);
  };

  // 조회
  const handleSearch = async () => {
    if (!selectedClient) { setError('거래처를 선택해주세요.'); return; }
    setError('');
    setLoading(true);
    try {
      const params = new URLSearchParams({
        client_code: selectedClient.code,
        start_date: startDate,
        end_date: endDate,
        type,
      });
      const res = await fetch(`/api/sales/ledger?${params}`);
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setClient(data.client);
      setRows(data.rows || []);
      setPrevBalance(data.prev_balance || 0);
      setCollapsedMonths(new Set());
      setCollapsedDays(new Set());
    } catch (err) {
      setError('조회 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 데이터 가공: 월별 → 일별 → 행
  const grouped = groupData(rows);

  // 총합계
  const grandTotal = {
    qty: rows.reduce((s, r) => s + (r.quantity || 0), 0),
    supply: rows.reduce((s, r) => s + (r.supply_amount || 0), 0),
    tax: rows.reduce((s, r) => s + (r.tax_amount || 0), 0),
    total: rows.reduce((s, r) => s + (r.total_amount || 0), 0),
  };

  const toggleMonth = (m: string) => {
    setCollapsedMonths(prev => {
      const next = new Set(prev);
      next.has(m) ? next.delete(m) : next.add(m);
      return next;
    });
  };
  const toggleDay = (d: string) => {
    setCollapsedDays(prev => {
      const next = new Set(prev);
      next.has(d) ? next.delete(d) : next.add(d);
      return next;
    });
  };

  return (
    <div>
      {/* 필터 영역 */}
      <div style={{
        background: '#fff',
        borderRadius: 14,
        border: '1px solid rgba(90,21,21,0.06)',
        boxShadow: '0 2px 8px rgba(90,21,21,0.03)',
        padding: 18,
        marginBottom: 16,
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#2c1810', marginBottom: 14 }}>
          매출처원장
        </div>

        {/* 창고 선택 */}
        <div style={{ display: 'flex', gap: 4, background: 'rgba(90,21,21,0.04)', borderRadius: 8, padding: 2, marginBottom: 12, alignSelf: 'flex-start', width: 'fit-content' }}>
          {([['wine', '까브드뱅'], ['glass', '대유라이프']] as const).map(([t, label]) => (
            <button key={t} onClick={() => handleTypeChange(t)} style={{
              padding: '8px 18px', borderRadius: 6, border: 'none',
              fontSize: 13, fontWeight: type === t ? 700 : 500,
              background: type === t ? '#fff' : 'transparent',
              color: type === t ? '#5A1515' : '#8a8580',
              cursor: 'pointer', boxShadow: type === t ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}>
              {label}
            </button>
          ))}
        </div>

        {/* 거래처 검색 */}
        <div ref={searchRef} style={{ position: 'relative', marginBottom: 12 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#8a8580', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            거래처
          </label>
          <input
            value={clientSearch}
            onChange={e => handleSearchChange(e.target.value)}
            onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
            placeholder="거래처명 또는 코드 검색"
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: 10,
              border: selectedClient ? '1.5px solid rgba(90,21,21,0.25)' : '1.5px solid rgba(90,21,21,0.08)',
              fontSize: 16,
              outline: 'none',
              boxSizing: 'border-box',
              background: selectedClient ? 'rgba(90,21,21,0.02)' : '#faf9f7',
            }}
          />
          {selectedClient && (
            <span style={{
              position: 'absolute', right: 12, top: 30,
              fontSize: 11, color: '#5A1515', fontWeight: 600, background: 'rgba(90,21,21,0.06)',
              padding: '2px 8px', borderRadius: 6,
            }}>
              {selectedClient.code}
            </span>
          )}
          {showSuggestions && suggestions.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
              background: '#fff', borderRadius: 10,
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              border: '1px solid rgba(90,21,21,0.08)',
              maxHeight: 250, overflowY: 'auto',
            }}>
              {suggestions.map((s, i) => (
                <div key={i} onClick={() => selectClient(s)} style={{
                  padding: '10px 14px', cursor: 'pointer',
                  borderBottom: i < suggestions.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(90,21,21,0.03)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ fontSize: 13, color: '#2c1810' }}>{s.name}</span>
                  <span style={{ fontSize: 11, color: '#8a8580' }}>{s.code} · {s.type === 'glass' ? '글라스' : '와인'}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 기간 + 타입 */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 130px' }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#8a8580', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              시작일
            </label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 10,
                border: '1.5px solid rgba(90,21,21,0.08)', fontSize: 16,
                outline: 'none', boxSizing: 'border-box', background: '#faf9f7',
              }}
            />
          </div>
          <div style={{ flex: '1 1 130px' }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#8a8580', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              종료일
            </label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 10,
                border: '1.5px solid rgba(90,21,21,0.08)', fontSize: 16,
                outline: 'none', boxSizing: 'border-box', background: '#faf9f7',
              }}
            />
          </div>
          <button onClick={handleSearch} disabled={loading} style={{
            padding: '10px 24px', borderRadius: 10, border: 'none',
            background: loading ? '#c4a0a0' : '#5A1515', color: '#fff',
            fontSize: 14, fontWeight: 600, cursor: loading ? 'default' : 'pointer',
            whiteSpace: 'nowrap', transition: 'background 0.2s',
          }}>
            {loading ? '조회 중...' : '조회'}
          </button>
        </div>

        {/* 빠른 기간 버튼 */}
        <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
          {getQuickRanges().map(r => (
            <button key={r.label} onClick={() => { setStartDate(r.start); setEndDate(r.end); }}
              style={{
                padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(90,21,21,0.1)',
                background: (startDate === r.start && endDate === r.end) ? 'rgba(90,21,21,0.06)' : 'transparent',
                fontSize: 11, color: '#5A1515', cursor: 'pointer', fontWeight: 500,
              }}>
              {r.label}
            </button>
          ))}
        </div>

        {error && (
          <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(220,38,38,0.04)', border: '1px solid rgba(220,38,38,0.15)', borderRadius: 8, fontSize: 12, color: '#dc2626' }}>
            {error}
          </div>
        )}
      </div>

      {/* 결과 테이블 */}
      {client && rows.length > 0 && (
        <div style={{
          background: '#fff',
          borderRadius: 14,
          border: '1px solid rgba(90,21,21,0.06)',
          boxShadow: '0 2px 8px rgba(90,21,21,0.03)',
          overflow: 'hidden',
        }}>
          {/* 헤더 정보 */}
          <div style={{
            padding: '14px 18px',
            borderBottom: '2px solid #5A1515',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            flexWrap: 'wrap', gap: 8,
          }}>
            <div>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#2c1810' }}>{client.client_name}</span>
              <span style={{ fontSize: 12, color: '#8a8580', marginLeft: 8 }}>{client.client_code}</span>
            </div>
            <div style={{ fontSize: 12, color: '#8a8580' }}>
              {startDate} ~ {endDate} · {rows.length}건
            </div>
          </div>

          {/* 테이블 */}
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700, fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f8f6f4', borderBottom: '1px solid rgba(90,21,21,0.1)' }}>
                  <th style={thStyle}>일자</th>
                  <th style={thStyle}>품목명</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>수량</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>단가</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>공급금액</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>부가세</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>합계</th>
                </tr>
              </thead>
              <tbody>
                {grouped.map(month => {
                  const mCollapsed = collapsedMonths.has(month.month);
                  return (
                    <MonthGroup
                      key={month.month}
                      month={month}
                      collapsed={mCollapsed}
                      collapsedDays={collapsedDays}
                      onToggleMonth={() => toggleMonth(month.month)}
                      onToggleDay={toggleDay}
                    />
                  );
                })}
                {/* 총합계 */}
                <tr style={{ background: '#5A1515', fontWeight: 700 }}>
                  <td style={{ ...tdStyle, fontWeight: 700, color: '#fff' }} colSpan={2}>
                    [{client.client_name} 합계]
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#fff' }}>{fmt(grandTotal.qty)}</td>
                  <td style={{ ...tdStyle, color: '#fff' }}></td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#fff' }}>{fmt(grandTotal.supply)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#fff' }}>{fmt(grandTotal.tax)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#fff' }}>{fmt(grandTotal.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 결과 없음 */}
      {client && rows.length === 0 && !loading && (
        <div style={{
          background: '#fff', borderRadius: 14, padding: 40,
          textAlign: 'center', color: '#8a8580', fontSize: 14,
          border: '1px solid rgba(90,21,21,0.06)',
        }}>
          해당 기간에 출고 내역이 없습니다.
        </div>
      )}

      {/* 안내 */}
      {!client && !loading && (
        <div style={{
          background: '#fff', borderRadius: 14, padding: 40,
          textAlign: 'center', color: '#8a8580', fontSize: 13,
          border: '1px solid rgba(90,21,21,0.06)',
          lineHeight: 1.8,
        }}>
          거래처를 검색하고 기간을 설정한 후<br/>
          <strong style={{ color: '#5A1515' }}>조회</strong> 버튼을 눌러주세요.
        </div>
      )}
    </div>
  );
}

/* ━━━ 월별 그룹 컴포넌트 ━━━ */
function MonthGroup({ month, collapsed, collapsedDays, onToggleMonth, onToggleDay }: {
  month: MonthData;
  collapsed: boolean;
  collapsedDays: Set<string>;
  onToggleMonth: () => void;
  onToggleDay: (d: string) => void;
}) {
  return (
    <>
      {!collapsed && month.days.map(day => (
        <DayGroup key={day.date} day={day} collapsed={collapsedDays.has(day.date)} onToggle={() => onToggleDay(day.date)} />
      ))}
      {/* 월계 */}
      <tr style={{ background: '#FFF8E1', cursor: 'pointer' }} onClick={onToggleMonth}>
        <td style={{ ...tdStyle, fontWeight: 700, color: '#5A1515' }} colSpan={2}>
          <span style={{ marginRight: 6 }}>{collapsed ? '▶' : '▼'}</span>
          {month.month} 월계
        </td>
        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#5A1515' }}>{fmt(month.totals.qty)}</td>
        <td style={tdStyle}></td>
        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#5A1515' }}>{fmt(month.totals.supply)}</td>
        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#5A1515' }}>{fmt(month.totals.tax)}</td>
        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#5A1515' }}>{fmt(month.totals.total)}</td>
      </tr>
    </>
  );
}

/* ━━━ 일별 그룹 컴포넌트 ━━━ */
function DayGroup({ day, collapsed, onToggle }: { day: DayData; collapsed: boolean; onToggle: () => void }) {
  return (
    <>
      {!collapsed && day.rows.map((r, i) => (
        <tr key={i} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
          <td style={{ ...tdStyle, color: '#8a8580', whiteSpace: 'nowrap' }}>
            {i === 0 ? day.date.slice(5) : ''}
          </td>
          <td style={{ ...tdStyle, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {r.item_name}
          </td>
          <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(r.quantity)}</td>
          <td style={{ ...tdStyle, textAlign: 'right', color: '#8a8580' }}>{fmt(r.unit_price)}</td>
          <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(r.supply_amount)}</td>
          <td style={{ ...tdStyle, textAlign: 'right', color: '#8a8580' }}>{fmt(r.tax_amount)}</td>
          <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{fmt(r.total_amount)}</td>
        </tr>
      ))}
      {/* 일계 */}
      {day.rows.length > 1 && (
        <tr style={{ background: 'rgba(90,21,21,0.02)', cursor: 'pointer' }} onClick={onToggle}>
          <td style={{ ...tdStyle, fontWeight: 600, color: '#8a8580', fontSize: 11 }} colSpan={2}>
            <span style={{ marginRight: 4 }}>{collapsed ? '▶' : '▼'}</span>
            {day.date.slice(5)} 일계
          </td>
          <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, fontSize: 11 }}>{fmt(day.totals.qty)}</td>
          <td style={tdStyle}></td>
          <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, fontSize: 11 }}>{fmt(day.totals.supply)}</td>
          <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, fontSize: 11 }}>{fmt(day.totals.tax)}</td>
          <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, fontSize: 11 }}>{fmt(day.totals.total)}</td>
        </tr>
      )}
    </>
  );
}

/* ━━━ 데이터 그룹화 ━━━ */
interface Totals { qty: number; supply: number; tax: number; total: number; }
interface DayData { date: string; rows: LedgerRow[]; totals: Totals; }
interface MonthData { month: string; days: DayData[]; totals: Totals; }

function groupData(rows: LedgerRow[]): MonthData[] {
  const monthMap = new Map<string, Map<string, LedgerRow[]>>();

  for (const r of rows) {
    const m = monthKey(r.ship_date);
    const d = dayKey(r.ship_date);
    if (!monthMap.has(m)) monthMap.set(m, new Map());
    const dayMap = monthMap.get(m)!;
    if (!dayMap.has(d)) dayMap.set(d, []);
    dayMap.get(d)!.push(r);
  }

  const result: MonthData[] = [];
  for (const [m, dayMap] of monthMap) {
    const days: DayData[] = [];
    const mTotals: Totals = { qty: 0, supply: 0, tax: 0, total: 0 };

    for (const [d, dRows] of dayMap) {
      const dTotals: Totals = { qty: 0, supply: 0, tax: 0, total: 0 };
      for (const r of dRows) {
        dTotals.qty += r.quantity || 0;
        dTotals.supply += r.supply_amount || 0;
        dTotals.tax += r.tax_amount || 0;
        dTotals.total += r.total_amount || 0;
      }
      mTotals.qty += dTotals.qty;
      mTotals.supply += dTotals.supply;
      mTotals.tax += dTotals.tax;
      mTotals.total += dTotals.total;
      days.push({ date: d, rows: dRows, totals: dTotals });
    }
    result.push({ month: m, days, totals: mTotals });
  }
  return result;
}

/* ━━━ 빠른 기간 ━━━ */
function getQuickRanges() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-indexed
  const today = now.toISOString().slice(0, 10);

  const pad = (n: number) => String(n).padStart(2, '0');

  const curStart = `${y}-${pad(m + 1)}-01`;
  const prevStart = m === 0 ? `${y - 1}-12-01` : `${y}-${pad(m)}-01`;
  const prevEnd = new Date(y, m, 0); // 이전 달 마지막 날
  const prevEndStr = `${prevEnd.getFullYear()}-${pad(prevEnd.getMonth() + 1)}-${pad(prevEnd.getDate())}`;

  const q = Math.floor(m / 3);
  const qStartMonth = q * 3 + 1; // 1-indexed
  const qStartYear = y;
  const qStart = `${qStartYear}-${pad(qStartMonth)}-01`;

  return [
    { label: '이번 달', start: curStart, end: today },
    { label: '지난 달', start: prevStart, end: prevEndStr },
    { label: '이번 분기', start: qStart, end: today },
    { label: '올해', start: `${y}-01-01`, end: today },
    { label: '작년', start: `${y - 1}-01-01`, end: `${y - 1}-12-31` },
    { label: '전체', start: '2020-01-01', end: today },
  ];
}

/* ━━━ 스타일 ━━━ */
const thStyle: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: 11,
  fontWeight: 700,
  color: '#5A1515',
  textAlign: 'left',
  whiteSpace: 'nowrap',
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
};

const tdStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 12,
  color: '#2c1810',
  whiteSpace: 'nowrap',
};
