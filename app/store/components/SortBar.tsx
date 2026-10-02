'use client';

// 재고 목록 정렬 선택 — 플랫 텍스트 탭(세로 구분선), 가로 스와이프. 검색 결과·메뉴 목록 위.
// 같은 기준을 다시 누르면 오름/내림 전환(화살표 표시).
import { SORT_DEFAULT_DIR, SORT_LABEL, type SortKey, type SortState } from '@/app/lib/store/types';

export function SortBar({ value, onChange }: { value: SortState; onChange: (s: SortState) => void }) {
  const pick = (k: SortKey) => onChange(
    value.key === k && k !== 'default'
      ? { key: k, dir: value.dir === 'asc' ? 'desc' : 'asc' }
      : { key: k, dir: SORT_DEFAULT_DIR[k] },
  );
  return (
    <div role="radiogroup" aria-label="정렬" style={{ overflowX: 'auto', scrollbarWidth: 'none', margin: '10px -2px 2px' }}>
      <div style={{ display: 'flex', alignItems: 'center', width: 'max-content' }}>
        {(Object.keys(SORT_LABEL) as SortKey[]).map((k, i) => (
          <button key={k} role="radio" aria-checked={value.key === k} onClick={() => pick(k)}
            style={{
              all: 'unset', cursor: 'pointer', padding: '4px 10px', fontSize: 12.5, whiteSpace: 'nowrap',
              fontWeight: value.key === k ? 700 : 400,
              color: value.key === k ? 'var(--text-primary)' : 'var(--text-tertiary)',
              borderLeft: i > 0 ? '1px solid var(--border-subtle)' : 'none',
            }}>
            {SORT_LABEL[k]}{value.key === k && k !== 'default' ? (value.dir === 'asc' ? ' ↑' : ' ↓') : ''}
          </button>
        ))}
      </div>
    </div>
  );
}
