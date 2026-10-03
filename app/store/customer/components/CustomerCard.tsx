'use client';

// 단골 카드 — 손님 한 명의 방문·구매·취향을 한 페이지로. KREAM 문법(헤어라인 리스트·스탯 스트립·칩 대신 도트+텍스트).
import { useState, type ReactNode } from 'react';
import { RoundBackButton } from '@/app/components/RoundBackButton';
import { GOLD, GOLD_LINE, LAT, fmt } from '../../brand';
import type { CustomerCardData } from '../types';
import { MemoEditor } from './MemoEditor';
import { ProfileEditor } from './ProfileEditor';
import { CustomerHeader } from './CustomerHeader';

const SOURCE_LABEL = { quiz: '맞춤 추천', stock: '재고 선택' } as const;
const md = (d: string) => `${d.slice(5, 7)}.${d.slice(8, 10)}`;
/** 스탯 줄용 만원 단위 — 1,842,000 → 184.2만 (좁은 칸에서 숫자 겹침 방지) */
const man = (n: number) => (n >= 10000 ? `${(Math.round(n / 1000) / 10).toLocaleString('ko-KR')}만` : fmt(n));

function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section style={{ marginTop: 28 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, paddingBottom: 8, borderBottom: '1px solid var(--border-default)' }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>{title}</span>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** 맛 막대 — 1~5 평균. 값 없으면 '—' */
function TasteBar({ label, v }: { label: string; v: number | null }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr 28px', alignItems: 'center', gap: 10, padding: '7px 0' }}>
      <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{label}</span>
      <span style={{ position: 'relative', height: 3, borderRadius: 2, background: 'var(--border-subtle)' }}>
        {v != null && <i style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(v / 5) * 100}%`, borderRadius: 2, background: GOLD }} />}
      </span>
      <span style={{ fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{v != null ? v.toFixed(1) : '—'}</span>
    </div>
  );
}

const row: React.CSSProperties = { display: 'flex', alignItems: 'baseline', gap: 10, padding: '11px 0', borderBottom: '1px solid var(--border-subtle)', minWidth: 0 };

export function CustomerCard({ d, onBack, onRecommend, onServe, onSaveMemo, onSaveProfile }: {
  d: CustomerCardData;
  onBack: () => void;
  onRecommend: () => void;   // 이 취향으로 바로 추천
  onServe: () => void;       // 이 손님으로 응대 시작
  onSaveMemo: (memo: string) => Promise<boolean>; // 직원 메모 저장
  onSaveProfile: React.ComponentProps<typeof ProfileEditor>['onSave']; // 연령대·성별 저장
}) {
  const s = d.stats;
  const [allPurchases, setAllPurchases] = useState(false); // 최근 구매 5건 → 더 보기로 전체
  const purchases = allPurchases ? d.purchases : d.purchases.slice(0, 5);
  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '20px 16px calc(110px + env(safe-area-inset-bottom))', color: 'var(--text-primary)' }}>
      <CustomerHeader />
      <div style={{ ...LAT, fontSize: 11, color: GOLD }}>REGULAR GUEST</div>

      {/* 손님 */}
      <h1 style={{ margin: '10px 0 0', fontSize: '1.5rem', fontWeight: 500 }}>{d.name} 님</h1>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 10px', marginTop: 6, fontSize: 12.5, color: 'var(--text-secondary)' }}>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{d.phoneMasked}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <i style={{ width: 6, height: 6, borderRadius: '50%', background: d.marketing ? 'var(--status-success)' : 'var(--border-default)' }} />
          {d.marketing ? '마케팅 수신 동의' : '마케팅 미동의'}
        </span>
        <span style={{ color: 'var(--text-tertiary)' }}>{d.firstVisit.replace(/-/g, '.')} 첫 방문 · 등록 {d.registeredBy}</span>
      </div>
      <div style={{ height: 1, background: GOLD_LINE, margin: '16px -16px 0' }} />

      {/* 스탯 스트립 */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-default)' }}>
        {([['방문', `${s.visits}회`], ['구매', `${s.purchases}회`], ['병수', `${s.bottles}병`], ['총액', man(s.amount)], ['평균 단가', man(s.avgUnit)]] as const).map(([k, v], i) => (
          <div key={k} style={{ flex: 1, padding: '12px 0', textAlign: 'center', borderLeft: i ? '1px solid var(--border-subtle)' : 'none', minWidth: 0 }}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{k}</div>
            <div style={{ marginTop: 2, fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'right' }}>최근 방문 {d.lastVisit.replace(/-/g, '.')}</div>

      {/* 손님 정보 — 직원이 대략 기록(추후 연령·성별·지역별 추천용). 배포 직후 옛 응답엔 없을 수 있어 있을 때만 */}
      {d.profile && (
        <Section title="손님 정보">
          <ProfileEditor profile={d.profile} onSave={onSaveProfile} />
        </Section>
      )}

      {/* 취향 */}
      <Section title="취향" aside={<span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>구매 기록 기준</span>}>
        {([['타입', d.taste.type], ['국가', d.taste.countries], ['산지', d.taste.regions], ['품종', d.taste.grapes]] as const).map(([k, v]) => (
          <div key={k} style={row}>
            <span style={{ flex: 'none', width: 44, fontSize: 12, color: 'var(--text-tertiary)' }}>{k}</span>
            <span style={{ fontSize: 13.5, fontWeight: 600 }}>{v || '—'}</span>
          </div>
        ))}
        <div style={{ padding: '8px 0 4px' }}>
          <TasteBar label="무게감" v={d.taste.body} />
          <TasteBar label="당도" v={d.taste.sweetness} />
          <TasteBar label="산미" v={d.taste.acidity} />
          <TasteBar label="탄닌" v={d.taste.tannin} />
        </div>
        {/* 자주 산 향 — 산 타입별 한 줄(레드 향·화이트 향이 섞여 잘리지 않게) */}
        {d.taste.flavorGroups.map((g) => (
          <div key={g.type} style={{ ...row, alignItems: 'flex-start' }}>
            <span style={{ flex: 'none', minWidth: 44, fontSize: 12, color: 'var(--text-tertiary)', paddingTop: 1 }}>{g.type} 향</span>
            <span style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px' }}>
              {g.flavors.map((f) => (
                <span key={f} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: 'var(--text-secondary)' }}>
                  <i style={{ width: 5, height: 5, borderRadius: '50%', background: GOLD }} />{f}
                </span>
              ))}
            </span>
          </div>
        ))}
        <div style={row}>
          <span style={{ flex: 'none', width: 44, fontSize: 12, color: 'var(--text-tertiary)' }}>문답</span>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{[d.taste.quiz.type, d.taste.quiz.body, d.taste.quiz.flavors, d.taste.quiz.price].filter(Boolean).join(' · ')}</span>
        </div>
      </Section>

      {/* 최근 구매 */}
      <Section title={allPurchases ? '전체 구매 이력' : '최근 구매'} aside={<span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{d.purchases.length}건</span>}>
        {purchases.length === 0 && <p style={{ margin: 0, padding: '14px 0', fontSize: 12.5, color: 'var(--text-muted)' }}>아직 구매 기록이 없어요</p>}
        {purchases.map((p, i) => (
          <div key={i} style={{ ...row, alignItems: 'flex-start' }}>
            <span style={{ flex: 'none', width: 38, fontSize: 12, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums', paddingTop: 1 }}>{md(p.date)}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
              <span style={{ display: 'block', marginTop: 2, fontSize: 11, color: 'var(--text-tertiary)' }}>
                {p.vintage ? `${p.vintage} · ` : ''}
                <span style={{ color: p.source === 'quiz' ? GOLD : undefined }}>{SOURCE_LABEL[p.source]}</span>
              </span>
            </span>
            <span style={{ flex: 'none', fontSize: 12.5, fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)' }}>{p.qty}병 · {fmt(p.amount)}</span>
          </div>
        ))}
        {d.purchases.length > 5 && (
          <button onClick={() => setAllPurchases((v) => !v)}
            style={{ all: 'unset', cursor: 'pointer', display: 'block', width: '100%', textAlign: 'center', padding: '12px 0', fontSize: 12.5, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>
            {allPurchases ? '접기' : `더 보기 · ${d.purchases.length - 5}건`}
          </button>
        )}
      </Section>

      {/* 문답 이력 */}
      <Section title="최근 문답" aside={<span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>전체 {d.sessionCount}회</span>}>
        {d.sessions.map((x, i) => (
          <div key={i} style={row}>
            <span style={{ flex: 'none', width: 38, fontSize: 12, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>{md(x.date)}</span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.answers}</span>
            <span style={{ flex: 'none', fontSize: 12, color: x.bought ? 'var(--status-success)' : 'var(--text-tertiary)' }}>{x.bought ? `구매 ${x.bought}병` : '구매 없음'}</span>
          </div>
        ))}
      </Section>

      {/* 직원 메모 */}
      <Section title="직원 메모" aside={<span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>직원만 보임</span>}>
        <MemoEditor key={d.memo} memo={d.memo} meta={d.memoMeta} onSave={onSaveMemo} />
      </Section>

      {/* 하단 고정 — 뒤로 · 응대 시작 · 이 취향으로 추천 */}
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 40, padding: '12px 16px calc(12px + env(safe-area-inset-bottom))',
        background: 'color-mix(in srgb, var(--surface) 92%, transparent)', backdropFilter: 'blur(8px)', borderTop: '1px solid var(--border-subtle)',
      }}>
        <div style={{ maxWidth: 560, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <RoundBackButton onClick={onBack} style={{ boxShadow: 'none' }} />
          <button onClick={onServe}
            style={{ flex: 1, height: 46, borderRadius: 999, border: `1px solid ${GOLD_LINE}`, background: 'var(--surface)', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' }}>
            응대 시작
          </button>
          <button onClick={onRecommend}
            style={{ flex: 1.4, height: 46, borderRadius: 999, border: 'none', background: 'var(--action)', fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer' }}>
            이 취향으로 추천
          </button>
        </div>
      </div>
    </div>
  );
}
