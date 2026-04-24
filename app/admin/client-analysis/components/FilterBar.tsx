'use client';

import Card from '@/app/components/ui/Card';
import { DateRangePresets } from '@/app/components/ui/DateRangePresets';
import type { Filters, FilterState } from '../types';

const selectStyle: React.CSSProperties = {
  height: 34, fontSize: 16, padding: '0 8px',
  border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
  background: 'var(--color-card)', color: 'var(--color-text)',
  minWidth: 0, flex: 1,
};

const labelStyle: React.CSSProperties = {
  fontSize: 11, color: 'var(--color-text-light)',
  fontWeight: 600, marginBottom: 2,
};

type Props = {
  filters: Filters | null;
  filterLoading: boolean;
  state: FilterState;
  update: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  reset: () => void;
};

export function FilterBar({ filters, filterLoading, state, update, reset }: Props) {
  return (
    <Card style={{ marginBottom: 16, padding: '12px 16px' }}>
      {filterLoading ? (
        <div style={{ textAlign: 'center', padding: 12, color: 'var(--color-text-lighter)', fontSize: 'var(--text-xs)' }}>
          필터 로딩 중...
        </div>
      ) : (
        <>
        <div style={{ marginBottom: 10 }}>
          <DateRangePresets
            startDate={state.startDate}
            endDate={state.endDate}
            onChange={(r) => {
              update('startDate', r.startDate);
              update('endDate', r.endDate);
            }}
          />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end' }}>
          <div style={{ minWidth: 90 }}>
            <div style={labelStyle}>담당자</div>
            <select style={selectStyle} value={state.manager} onChange={e => update('manager', e.target.value)}>
              <option value="">전체</option>
              {filters?.managers.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div style={{ minWidth: 80 }}>
            <div style={labelStyle}>부서</div>
            <select style={selectStyle} value={state.department} onChange={e => update('department', e.target.value)}>
              <option value="">전체</option>
              {filters?.departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div style={{ minWidth: 90 }}>
            <div style={labelStyle}>업종</div>
            <select style={selectStyle} value={state.businessType} onChange={e => update('businessType', e.target.value)}>
              <option value="">전체</option>
              {filters?.businessTypes.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div style={{ minWidth: 120 }}>
            <div style={labelStyle}>시작일</div>
            <input type="date" style={selectStyle} value={state.startDate} onChange={e => update('startDate', e.target.value)} />
          </div>
          <div style={{ minWidth: 120 }}>
            <div style={labelStyle}>종료일</div>
            <input type="date" style={selectStyle} value={state.endDate} onChange={e => update('endDate', e.target.value)} />
          </div>
          <div style={{ minWidth: 100, flex: 1 }}>
            <div style={labelStyle}>거래처</div>
            <input
              type="text" style={selectStyle} placeholder="검색"
              value={state.clientSearch} onChange={e => update('clientSearch', e.target.value)}
            />
          </div>
          <button
            onClick={reset}
            style={{
              height: 34, padding: '0 12px', fontSize: 'var(--text-xs)',
              border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
              background: 'var(--color-background)', cursor: 'pointer', color: 'var(--color-text-light)',
              whiteSpace: 'nowrap',
            }}
          >
            초기화
          </button>
        </div>
        </>
      )}
    </Card>
  );
}
