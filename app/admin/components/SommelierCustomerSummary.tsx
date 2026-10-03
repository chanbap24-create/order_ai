'use client';

// 관리자 소믈리에 탭 — 손님 펼침 상단 요약. 단골 카드와 같은 항목(방문·구매 숫자, 취향, 동의·등록 직원).
// 계산은 서버 buildTastes(엑셀·단골 카드 공용) 결과를 그대로 표시만 한다.
import type { CustomerTaste } from '@/app/lib/sommelierExport/data';

export type TasteSummary = Omit<CustomerTaste, 'customer'>;

const won = (n: number) => (n || 0).toLocaleString('ko-KR');
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('ko-KR') : '—');
const cell = (k: string, v: string) => (
  <div key={k} style={{ flex: 1, padding: '9px 0', textAlign: 'center', minWidth: 0 }}>
    <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>{k}</div>
    <div style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{v}</div>
  </div>
);

export function SommelierCustomerSummary({ t, marketing, createdBy }: { t?: TasteSummary; marketing: boolean | null; createdBy: string | null }) {
  const bar = (k: string, v: number | null) => (
    <span key={k} style={{ fontSize: 12, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
      {k} <b style={{ color: 'var(--text-primary)' }}>{v != null ? v.toFixed(1) : '—'}</b>
    </span>
  );
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 8 }}>
        <span style={{ color: marketing ? 'var(--status-success)' : undefined }}>● {marketing ? '마케팅 수신 동의' : '마케팅 미동의'}</span>
        <span>등록 {createdBy || '—'}</span>
        <span>첫 방문 {day(t?.firstVisit ?? null)}</span>
        <span>최근 방문 {day(t?.lastVisit ?? null)}</span>
        <span>최근 구매 {day(t?.lastPurchase ?? null)}</span>
      </div>
      {t && (
        <>
          <div style={{ display: 'flex', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
            {cell('방문', `${t.sessions}회`)}{cell('구매', `${t.sales}회`)}{cell('병수', `${t.bottles}병`)}
            {cell('총액', `${won(t.amount)}원`)}{cell('평균 단가', `${won(t.avgUnit)}원`)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '64px 1fr', rowGap: 5, padding: '10px 0 0', fontSize: 12.5 }}>
            <span style={{ color: 'var(--text-tertiary)' }}>선호</span>
            <span>{[t.topType, t.topCountries, t.topRegions, t.topGrapes].filter(Boolean).join(' · ') || '—'}</span>
            <span style={{ color: 'var(--text-tertiary)' }}>맛 평균</span>
            <span style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 12px' }}>
              {bar('무게감', t.avgBody)}{bar('당도', t.avgSweet)}{bar('산미', t.avgAcid)}{bar('탄닌', t.avgTannin)}
            </span>
            <span style={{ color: 'var(--text-tertiary)' }}>자주 산 향</span>
            <span>{t.topFlavors || '—'}</span>
            <span style={{ color: 'var(--text-tertiary)' }}>문답 선호</span>
            <span>{[t.quizType, t.quizBody, t.quizFlavors, t.quizPrice].filter(Boolean).join(' · ') || '—'}</span>
            <span style={{ color: 'var(--text-tertiary)' }}>추천 구매</span>
            <span>{t.recShare != null ? `${t.recShare}% (맞춤 추천에서 산 비율)` : '—'}</span>
          </div>
        </>
      )}
    </div>
  );
}
