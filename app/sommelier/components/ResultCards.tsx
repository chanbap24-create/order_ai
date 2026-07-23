'use client';

// 추천 결과 — 헤어라인 연속 행(박스 카드 금지): 병샷·이름·산지·향미칩·판매가·매칭 이유.
import type { SommelierResult } from '@/app/lib/sommelierRecommend';

const won = (n: number) => n.toLocaleString('ko-KR');

export function ResultCards({ results, onRetry }: {
  results: SommelierResult[];
  onRetry: () => void;
}) {
  if (results.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0' }}>
        <div style={{ fontSize: 15, color: 'var(--text-secondary)' }}>조건에 맞는 재고 와인이 없어요</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginTop: 6 }}>가격대나 타입을 넓혀서 다시 찾아보세요</div>
        <button onClick={onRetry} style={retryStyle}>다시 문답하기</button>
      </div>
    );
  }
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        padding: '4px 0 12px', borderBottom: '1px solid var(--border-subtle)',
      }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>추천 와인 {results.length}</span>
        <button onClick={onRetry} style={{
          border: 'none', background: 'none', fontSize: 13, color: 'var(--text-tertiary)',
          cursor: 'pointer', textDecoration: 'underline', padding: 0,
        }}>다시 문답</button>
      </div>

      {results.map((r, i) => (
        <div key={r.item_code} style={{
          display: 'flex', gap: 14, padding: '18px 0',
          borderBottom: i === results.length - 1 ? 'none' : '1px solid var(--border-subtle)',
        }}>
          <div style={{ width: 72, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/sales/wine-img?code=${encodeURIComponent(r.item_code)}`} alt={r.name}
              style={{ maxHeight: 110, maxWidth: 72, objectFit: 'contain' }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
              {i + 1}순위
            </div>
            <div style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>{r.name}</div>
            {r.name_en && <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 1 }}>{r.name_en}</div>}
            {(r.country || r.region) && (
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 3 }}>
                {[r.country, r.region].filter(Boolean).join(' · ')}
              </div>
            )}
            {r.flavors.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 7 }}>
                {r.flavors.map((f) => (
                  <span key={f} style={{
                    fontSize: 11, color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)',
                    borderRadius: 999, padding: '2px 8px',
                  }}>{f}</span>
                ))}
              </div>
            )}
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.55 }}>
              {r.reason}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
              <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                {won(r.retail_price)}원
              </span>
              <span style={{ fontSize: 11.5, color: r.stock <= 3 ? 'var(--status-danger)' : 'var(--text-muted)' }}>
                재고 {r.stock}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

const retryStyle: React.CSSProperties = {
  marginTop: 20, height: 44, padding: '0 24px', borderRadius: 8, fontSize: 14, fontWeight: 600,
  border: '1px solid var(--border-default)', background: 'var(--surface)', color: 'var(--text-primary)', cursor: 'pointer',
};
