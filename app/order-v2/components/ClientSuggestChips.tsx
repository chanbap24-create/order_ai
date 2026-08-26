'use client';

import { useClientSuggest } from '../hooks/useClientSuggest';
import { ORDER_COLORS } from '../constants';
import type { Client } from '../types';

type Props = {
  orderText: string;
  selected: Client | null;
  tab: string;
  onPick: (c: Client) => void;
};

/**
 * 발주 텍스트 기반 거래처 추천 칩 (품목 매칭 + 60일 빈도).
 * 거래처 미선택 상태에서 발주문이 있으면 검색창 아래 표시 — 탭 1번 선택.
 */
export function ClientSuggestChips({ orderText, selected, tab, onPick }: Props) {
  const suggestions = useClientSuggest(orderText, !!selected, tab);
  if (selected || suggestions.length === 0) return null;

  return (
    <div style={{ margin: '-8px 0 16px', display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
      <span style={{ fontSize: 11, color: ORDER_COLORS.textMuted, fontWeight: 600 }}>추천</span>
      {suggestions.map((s) => (
        <button
          key={s.client_code}
          onClick={() => onPick({ client_code: s.client_code, client_name: s.client_name } as Client)}
          style={{
            padding: '5px 11px',
            fontSize: 12,
            fontWeight: 600,
            borderRadius: 8,
            border: '1px solid var(--border-default)',
            background: ORDER_COLORS.surface,
            color: ORDER_COLORS.text,
            cursor: 'pointer',
            maxWidth: 180,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {s.client_name}
        </button>
      ))}
    </div>
  );
}
