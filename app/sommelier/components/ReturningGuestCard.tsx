'use client';

// 재방문 손님 카드(손님용) — 손님 앞 화면. 취향·최근 구매만(금액·수량·연락처·메모 없음).
// 여기서 세 갈래: 지난 구매로 추천 / 새 취향으로 고르기 / 재고에서 선택. 직원용 카드는 작은 링크로만.
import { useEffect, useState } from 'react';
import { RoundBackButton } from '@/app/components/RoundBackButton';
import { SommelierMenu } from './SommelierMenu';
import type { QuizAnswers } from '../lib/quiz';
import type { SommelierCustomer } from '@/app/lib/sommelierDb';
import type { WelcomeInfo } from '@/app/lib/sommelierCustomerCard';

const md = (d: string) => `${d.slice(5, 7)}.${d.slice(8, 10)}`;
const line: React.CSSProperties = { display: 'flex', alignItems: 'baseline', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--som-line)', minWidth: 0 };
const key: React.CSSProperties = { flex: 'none', width: 40, fontSize: 12, color: 'var(--som-muted)' };

function Choice({ title, sub, primary, onClick }: { title: string; sub: string; primary?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      style={{
        all: 'unset', boxSizing: 'border-box', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, width: '100%',
        padding: '13px 20px', borderRadius: 12, marginTop: 8,
        background: primary ? 'var(--som-ink)' : 'transparent', color: primary ? '#f6eadf' : 'var(--som-ink)',
        border: primary ? '1px solid var(--som-ink)' : '1px solid var(--som-line)',
      }}>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 15, fontWeight: 600 }}>{title}</span>
        <span style={{ display: 'block', marginTop: 3, fontSize: 12, opacity: 0.7 }}>{sub}</span>
      </span>
      <span aria-hidden style={{ fontSize: 20, opacity: 0.7 }}>›</span>
    </button>
  );
}

export function ReturningGuestCard({ c, onAuto, onQuiz, onStock, onBack, onHome }: {
  c: SommelierCustomer;
  onAuto: (a: QuizAnswers) => void; // 지난 구매(없으면 지난 문답) 취향으로 바로 추천
  onQuiz: () => void;               // 새 취향 문답
  onStock: () => void;              // 기존 재고에서 선택
  onBack: () => void;               // 손님 정보 입력으로
  onHome: () => void;
}) {
  const [w, setW] = useState<WelcomeInfo | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`/api/sommelier/customer/${c.id}/welcome`).then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (alive) setW(j); }).catch(() => {});
    return () => { alive = false; };
  }, [c.id]);
  const t = w?.taste;
  // 동의는 체크 즉시 저장 — 재방문은 손님 재등록을 거치지 않으므로 여기서 받는다
  const setConsent = (patch: { consent?: true; marketing?: boolean }) => {
    setW((cur) => (cur ? { ...cur, ...(patch.consent ? { consentCurrent: true } : {}), ...(patch.marketing != null ? { marketing: patch.marketing } : {}) } : cur));
    fetch(`/api/sommelier/customer/${c.id}/consent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
    }).catch(() => {});
  };

  return (
    <section className="som-screen">
      <div className="som-brand"><button type="button" className="som-lat som-home" onClick={onHome} aria-label="매장 앱 메인으로">CAVE DE VIN</button><span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>취향 문답<SommelierMenu /></span></div>
      <div className="som-prog"><i style={{ width: '8%' }} /></div>
      <div className="som-q" style={{ paddingTop: 'min(4vh,36px)' }}>
        <div className="som-qno som-lat som-rise" style={{ ['--i' as string]: 0 }}>WELCOME BACK</div>
        <div className="som-rise" style={{ ['--i' as string]: 1, marginTop: 10, fontSize: 20, lineHeight: 1.45 }}>
          다시 찾아주셔서 감사합니다,<br /><b style={{ fontWeight: 600 }}>{c.name}</b> 님
        </div>

        <div className="som-rise" style={{ ['--i' as string]: 2, marginTop: 18 }}>
          {t && (t.type || t.countries || t.regions || t.grapes) && (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, paddingBottom: 8, borderBottom: '1px solid var(--som-line)' }}>즐겨 찾으신 와인</div>
              {([['타입', t.type], ['나라', t.countries], ['산지', t.regions], ['품종', t.grapes]] as const).filter(([, v]) => v).map(([k, v]) => (
                <div key={k} style={line}><span style={key}>{k}</span><span style={{ fontSize: 14 }}>{v}</span></div>
              ))}
              {t.flavorGroups.map((g) => (
                <div key={g.type} style={{ ...line, alignItems: 'flex-start' }}>
                  <span style={{ ...key, width: 'auto', minWidth: 40 }}>{g.type} 향</span>
                  <span style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px' }}>
                    {g.flavors.map((f) => (
                      <span key={f} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--som-muted)' }}>
                        <i style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--som-gold)' }} />{f}
                      </span>
                    ))}
                  </span>
                </div>
              ))}
            </>
          )}
          {w && w.purchases.length > 0 && (
            <>
              <div style={{ marginTop: 18, fontSize: 13, fontWeight: 700, paddingBottom: 8, borderBottom: '1px solid var(--som-line)' }}>최근 고르신 와인</div>
              {w.purchases.map((p, i) => (
                <div key={i} style={line}>
                  <span style={{ ...key, fontVariantNumeric: 'tabular-nums' }}>{md(p.date)}</span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                </div>
              ))}
            </>
          )}
        </div>

        {/* 동의 — 수집 항목이 바뀐 뒤 처음 오신 손님은 재동의, 광고성 수신은 언제든 동의·철회 */}
        {w && (
          <div className="som-rise" style={{ ['--i' as string]: 3, marginTop: 18 }}>
            {!w.consentCurrent && (
              <label className="som-consent">
                <input type="checkbox" checked={false} onChange={() => setConsent({ consent: true })} />
                <span><b>[필수]</b> 수집 항목이 추가되었어요. 성함·연락처, 구매·취향 기록, 연령대·성별(직원 기록)을 와인 추천 및 재방문 응대에 이용하는 데 동의합니다.</span>
              </label>
            )}
            <label className="som-consent">
              <input type="checkbox" checked={w.marketing} onChange={(e) => setConsent({ marketing: e.target.checked })} />
              <span><b>[선택]</b> 신상품·행사 등 광고성 정보 수신(문자)에 동의합니다.</span>
            </label>
          </div>
        )}

        {/* 세 갈래 */}
        <div className="som-rise" style={{ ['--i' as string]: 3, marginTop: 18 }}>
          {w?.suggested && <Choice primary title="지난 취향으로 추천" sub="고르셨던 와인을 바탕으로 바로 골라드려요" onClick={() => onAuto(w.suggested!)} />}
          <Choice title="새 취향으로 고르기" sub="오늘 기분에 맞춰 몇 가지 여쭤볼게요" onClick={onQuiz} />
          <Choice title="재고에서 선택" sub="매장에 있는 와인을 직접 보며 골라요" onClick={onStock} />
        </div>

        <div className="som-subrow" style={{ marginTop: 'auto', paddingTop: 20 }}>
          <RoundBackButton onClick={onBack} label="이전" style={{ boxShadow: '0 4px 10px -4px rgba(0,0,0,0.18)' }} />
          {/* 직원용 — 금액·메모가 있는 단골 카드(본인이 등록한 손님 또는 관리자만) */}
          {w?.canViewCard && (
            <a href={`/store/customer/${c.id}?from=sommelier`}
              style={{ fontSize: 11.5, color: 'var(--som-muted)', opacity: 0.7, textDecoration: 'underline', textUnderlineOffset: 3 }}>
              직원용 카드
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
