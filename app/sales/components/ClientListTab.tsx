'use client';

import { useState, useEffect, useMemo } from 'react';

interface ClientRow {
  client_code: string;
  client_name: string;
  business_type: string;
  period_supply: number;
  period_total: number;
  period_qty: number;
  order_days: number;
  last_order_date: string;
}

type SortKey = 'client_name' | 'business_type' | 'period_total' | 'period_supply' | 'period_qty' | 'order_days' | 'last_order_date';
type SortDir = 'asc' | 'desc';

function fmt(n: number) { return n.toLocaleString(); }
function fmtDate(d: string) { return d ? d.slice(0, 10) : '-'; }

// 기간 프리셋 (KST)
function getKstNow() { return new Date(Date.now() + 9 * 60 * 60 * 1000); }
function toDateStr(d: Date) { return d.toISOString().slice(0, 10); }

function getPresetRange(preset: string): [string, string] {
  const now = getKstNow();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth(); // 0-based
  const today = toDateStr(now);

  switch (preset) {
    case 'thisMonth':
      return [`${y}-${String(m + 1).padStart(2, '0')}-01`, today];
    case 'lastMonth': {
      const lm = m === 0 ? 11 : m - 1;
      const ly = m === 0 ? y - 1 : y;
      const lastDay = new Date(Date.UTC(ly, lm + 1, 0)).getUTCDate();
      return [`${ly}-${String(lm + 1).padStart(2, '0')}-01`, `${ly}-${String(lm + 1).padStart(2, '0')}-${lastDay}`];
    }
    case 'last3Months': {
      const sm = m - 2 < 0 ? m - 2 + 12 : m - 2;
      const sy = m - 2 < 0 ? y - 1 : y;
      return [`${sy}-${String(sm + 1).padStart(2, '0')}-01`, today];
    }
    case 'thisYear':
      return [`${y}-01-01`, today];
    case 'lastYear':
      return [`${y - 1}-01-01`, `${y - 1}-12-31`];
    case 'custom':
    default:
      return [`${y}-${String(m + 1).padStart(2, '0')}-01`, today];
  }
}

export default function ClientListTab({ currentManager, isAdmin }: { currentManager: string; isAdmin: boolean }) {
  // 필터
  const [preset, setPreset] = useState('thisMonth');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [type, setType] = useState<'wine' | 'glass'>('wine');
  const [managerFilter, setManagerFilter] = useState(currentManager);
  const [managerList, setManagerList] = useState<string[]>([]);

  // 데이터
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [businessTypes, setBusTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalClients, setTotalClients] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [totalSupply, setTotalSupply] = useState(0);

  // 정렬
  const [sortKey, setSortKey] = useState<SortKey>('period_total');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // 초기 기간 설정
  useEffect(() => {
    const [s, e] = getPresetRange('thisMonth');
    setStartDate(s);
    setEndDate(e);
  }, []);

  // 관리자일 경우 담당자 목록 로드
  useEffect(() => {
    if (isAdmin) {
      fetch('/api/sales/clients/managers').then(r => r.json()).then(d => {
        if (d.managers) setManagerList(d.managers);
      }).catch(() => {});
    }
  }, [isAdmin]);

  // 프리셋 변경
  useEffect(() => {
    if (preset !== 'custom') {
      const [s, e] = getPresetRange(preset);
      setStartDate(s);
      setEndDate(e);
    }
  }, [preset]);

  // 데이터 로드
  useEffect(() => {
    if (!startDate || !endDate || !managerFilter) return;
    setLoading(true);
    const params = new URLSearchParams({
      manager: managerFilter,
      start: startDate,
      end: endDate,
      type,
    });
    if (businessType) params.set('business_type', businessType);

    fetch(`/api/sales/client-list?${params}`)
      .then(r => r.json())
      .then(d => {
        setClients(d.clients || []);
        setBusTypes(d.businessTypes || []);
        setTotalClients(d.totalClients || 0);
        setTotalAmount(d.totalAmount || 0);
        setTotalSupply(d.totalSupply || 0);
      })
      .catch(() => setClients([]))
      .finally(() => setLoading(false));
  }, [startDate, endDate, managerFilter, businessType, type]);

  // 정렬 로직
  const sortedClients = useMemo(() => {
    const arr = [...clients];
    arr.sort((a, b) => {
      let va: string | number = a[sortKey] ?? '';
      let vb: string | number = b[sortKey] ?? '';
      if (typeof va === 'number' && typeof vb === 'number') {
        return sortDir === 'asc' ? va - vb : vb - va;
      }
      va = String(va);
      vb = String(vb);
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    });
    return arr;
  }, [clients, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'client_name' || key === 'business_type' ? 'asc' : 'desc');
    }
  };

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return ' ↕';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  };

  const selectStyle: React.CSSProperties = {
    padding: '8px 12px',
    borderRadius: 8,
    border: '1.5px solid rgba(90,21,21,0.08)',
    fontSize: 13,
    background: '#faf9f7',
    color: '#2c1810',
    outline: 'none',
    cursor: 'pointer',
    minWidth: 0,
  };

  const dateStyle: React.CSSProperties = {
    padding: '8px 10px',
    borderRadius: 8,
    border: '1.5px solid rgba(90,21,21,0.08)',
    fontSize: 13,
    background: '#faf9f7',
    color: '#2c1810',
    outline: 'none',
    minWidth: 0,
    flex: '1 1 120px',
  };

  return (
    <div>
      {/* 필터 영역 */}
      <div style={{
        background: '#fff',
        borderRadius: 14,
        border: '1px solid rgba(90,21,21,0.06)',
        boxShadow: '0 2px 8px rgba(90,21,21,0.03)',
        padding: '16px',
        marginBottom: 16,
      }}>
        {/* 1행: 타입 + 담당자 (관리자) */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          {/* Wine / Glass 토글 */}
          <div style={{
            display: 'inline-flex',
            background: 'rgba(90,21,21,0.04)',
            borderRadius: 8,
            padding: 2,
          }}>
            {(['wine', 'glass'] as const).map(t => (
              <button
                key={t}
                onClick={() => { setType(t); setBusinessType(''); }}
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  border: 'none',
                  fontSize: 12,
                  fontWeight: type === t ? 700 : 500,
                  background: type === t ? '#fff' : 'transparent',
                  color: type === t ? '#5A1515' : '#8a8580',
                  cursor: 'pointer',
                  boxShadow: type === t ? '0 1px 3px rgba(90,21,21,0.08)' : 'none',
                  transition: 'all 0.2s',
                }}
              >
                {t === 'wine' ? 'Wine' : 'Glass'}
              </button>
            ))}
          </div>

          {/* 관리자 → 담당자 선택 */}
          {isAdmin && managerList.length > 0 && (
            <select
              value={managerFilter}
              onChange={e => setManagerFilter(e.target.value)}
              style={selectStyle}
            >
              {managerList.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          )}
        </div>

        {/* 2행: 기간 프리셋 + 날짜 + 업종 */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            value={preset}
            onChange={e => setPreset(e.target.value)}
            style={selectStyle}
          >
            <option value="thisMonth">이번 달</option>
            <option value="lastMonth">지난 달</option>
            <option value="last3Months">최근 3개월</option>
            <option value="thisYear">올해</option>
            <option value="lastYear">작년</option>
            <option value="custom">직접 입력</option>
          </select>

          {preset === 'custom' && (
            <>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                style={dateStyle}
              />
              <span style={{ color: '#8a8580', fontSize: 13 }}>~</span>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                style={dateStyle}
              />
            </>
          )}

          <select
            value={businessType}
            onChange={e => setBusinessType(e.target.value)}
            style={{ ...selectStyle, flex: '0 1 auto' }}
          >
            <option value="">전체 업종</option>
            {businessTypes.map(bt => <option key={bt} value={bt}>{bt}</option>)}
          </select>
        </div>
      </div>

      {/* 요약 카드 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 10,
        marginBottom: 16,
      }}>
        {[
          { label: '거래처 수', value: `${fmt(totalClients)}개`, color: '#5A1515' },
          { label: '공급가 합계', value: `${fmt(totalSupply)}원`, color: '#1a6b3c' },
          { label: '총액 합계', value: `${fmt(totalAmount)}원`, color: '#1a4d8c' },
        ].map(card => (
          <div key={card.label} style={{
            background: '#fff',
            borderRadius: 12,
            border: '1px solid rgba(90,21,21,0.06)',
            padding: '12px 14px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 11, color: '#8a8580', marginBottom: 4 }}>{card.label}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: card.color }}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* 테이블 */}
      <div style={{
        background: '#fff',
        borderRadius: 14,
        border: '1px solid rgba(90,21,21,0.06)',
        boxShadow: '0 2px 8px rgba(90,21,21,0.03)',
        overflow: 'hidden',
      }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#8a8580', fontSize: 14 }}>
            불러오는 중...
          </div>
        ) : clients.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#8a8580', fontSize: 14 }}>
            해당 기간에 거래 내역이 없습니다.
          </div>
        ) : (
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid rgba(90,21,21,0.08)' }}>
                  {([
                    { key: 'client_name' as SortKey, label: '거래처명' },
                    { key: 'business_type' as SortKey, label: '업종' },
                    { key: 'last_order_date' as SortKey, label: '최종발주일' },
                    { key: 'order_days' as SortKey, label: '발주일수' },
                    { key: 'period_qty' as SortKey, label: '수량' },
                    { key: 'period_supply' as SortKey, label: '공급가' },
                    { key: 'period_total' as SortKey, label: '총액' },
                  ]).map(col => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      style={{
                        padding: '12px 10px',
                        fontSize: 12,
                        fontWeight: 700,
                        color: sortKey === col.key ? '#5A1515' : '#6b6560',
                        textAlign: col.key === 'client_name' || col.key === 'business_type' ? 'left' : 'right',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        userSelect: 'none',
                        background: sortKey === col.key ? 'rgba(90,21,21,0.03)' : 'transparent',
                        transition: 'background 0.2s',
                        position: 'sticky',
                        top: 0,
                      }}
                    >
                      {col.label}{sortIcon(col.key)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedClients.map((c, i) => (
                  <tr
                    key={c.client_code || c.client_name + i}
                    style={{
                      borderBottom: '1px solid rgba(90,21,21,0.04)',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(90,21,21,0.02)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '10px 10px', fontSize: 13, fontWeight: 600, color: '#2c1810' }}>
                      {c.client_name}
                    </td>
                    <td style={{ padding: '10px 10px', fontSize: 12, color: '#8a8580' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: 6,
                        background: 'rgba(90,21,21,0.04)',
                        fontSize: 11,
                        color: '#6b6560',
                      }}>
                        {c.business_type || '-'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 10px', fontSize: 12, color: '#6b6560', textAlign: 'right' }}>
                      {fmtDate(c.last_order_date)}
                    </td>
                    <td style={{ padding: '10px 10px', fontSize: 12, color: '#6b6560', textAlign: 'right' }}>
                      {c.order_days}일
                    </td>
                    <td style={{ padding: '10px 10px', fontSize: 12, color: '#6b6560', textAlign: 'right' }}>
                      {fmt(c.period_qty)}
                    </td>
                    <td style={{ padding: '10px 10px', fontSize: 13, color: '#2c1810', textAlign: 'right', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
                      {fmt(c.period_supply)}
                    </td>
                    <td style={{ padding: '10px 10px', fontSize: 13, color: '#5A1515', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      {fmt(c.period_total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 기간 표시 */}
      {!loading && clients.length > 0 && (
        <div style={{ textAlign: 'center', fontSize: 11, color: '#a8a098', marginTop: 12 }}>
          {startDate} ~ {endDate} · {managerFilter} · {businessType || '전체 업종'} · {type === 'wine' ? 'Wine' : 'Glass'}
        </div>
      )}
    </div>
  );
}
