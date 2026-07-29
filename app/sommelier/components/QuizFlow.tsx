'use client';

// 취향 문답 5단계 — 타입 → 무게감 → 향미(멀티) → 산지(멀티) → 가격.
// 단일 선택은 즉시 다음으로, 멀티는 [다음] 버튼. 마지막 선택 시 제출.
import { useState } from 'react';
import {
  BODY_OPTIONS, COUNTRY_OPTIONS, FLAVOR_GROUPS, PRICE_OPTIONS, TYPE_OPTIONS,
  EMPTY_ANSWERS, type QuizAnswers,
} from '../lib/quiz';

const STEP_META = [
  { code: 'Q.1 — TYPE', title: null }, // 타입은 컬러 오브가 말함 — 헤드라인·주석 없음
  { code: 'Q.2 — BODY', title: <>입안의 무게감은<br />어느 쪽이 좋으세요?</> },
  { code: 'Q.3 — FLAVOR', title: <>끌리는 향미를<br />모두 골라주세요</> },
  { code: 'Q.4 — ORIGIN', title: <>선호하는 산지가<br />있으세요?</> },
  { code: 'Q.5 — PRICE', title: <>생각하시는<br />가격대는요?</> },
];

export function QuizFlow({ onSubmit, submitting, onExit }: {
  onSubmit: (a: QuizAnswers) => void;
  submitting: boolean;
  onExit: () => void;
}) {
  const [step, setStep] = useState(0);
  const [a, setA] = useState<QuizAnswers>(EMPTY_ANSWERS);

  const next = () => setStep((s) => Math.min(s + 1, 4));
  const back = () => (step === 0 ? onExit() : setStep((s) => s - 1));
  const meta = STEP_META[step];
  const toggle = (arr: string[], k: string) => (arr.includes(k) ? arr.filter((x) => x !== k) : [...arr, k]);

  return (
    <section className="som-screen" key={step}>
      <div className="som-brand"><span className="som-lat">CAVE DE VIN</span><span>취향 문답</span></div>
      <div className="som-prog"><i style={{ width: `${((step + 1) / 5) * 100}%` }} /></div>
      <div className="som-q">
        <div className="som-qno som-lat som-rise" style={{ ['--i' as string]: 0 }}>{meta.code}</div>
        {meta.title && <h2 className="som-rise" style={{ ['--i' as string]: 1 }}>{meta.title}</h2>}

        <div className="som-opts">
          {step === 0 && TYPE_OPTIONS.map((o, i) => (
            <button key={String(o.value)} className="som-opt som-rise" style={{ ['--i' as string]: i + 1 }}
              onClick={() => { setA({ ...a, type: o.value }); next(); }}>
              {o.label}
            </button>
          ))}
          {step === 1 && BODY_OPTIONS.map((o, i) => (
            <button key={String(o.value)} className="som-opt som-rise" style={{ ['--i' as string]: i + 2 }}
              onClick={() => { setA({ ...a, body: o.value }); next(); }}>
              {o.label} {o.desc && <small>{o.desc}</small>}
            </button>
          ))}
          {step === 2 && Object.entries(FLAVOR_GROUPS).map(([key, g], i) => (
            <button key={key} className={`som-opt som-rise${a.flavorGroups.includes(key) ? ' sel' : ''}`}
              style={{ ['--i' as string]: i + 2 }}
              onClick={() => setA({ ...a, flavorGroups: toggle(a.flavorGroups, key) })}>
              {g.label} <small>{g.desc}</small>
            </button>
          ))}
          {step === 3 && Object.entries(COUNTRY_OPTIONS).map(([key, c], i) => (
            <button key={key} className={`som-opt som-rise${a.countries.includes(key) ? ' sel' : ''}`}
              style={{ ['--i' as string]: i + 2 }}
              onClick={() => setA({ ...a, countries: toggle(a.countries, key) })}>
              {c.label} <small>{c.desc}</small>
            </button>
          ))}
          {step === 4 && PRICE_OPTIONS.map((o, i) => (
            <button key={o.label} className="som-opt som-rise" style={{ ['--i' as string]: i + 2 }}
              onClick={() => onSubmit({ ...a, priceMin: o.min, priceMax: o.max })} disabled={submitting}>
              {o.label}
            </button>
          ))}
        </div>

        <div className="som-subrow som-rise" style={{ ['--i' as string]: 9 }}>
          <button className="som-link" onClick={back}>이전</button>
          {step === 2 && (
            <button className="som-next" onClick={next}>
              {a.flavorGroups.length ? `${a.flavorGroups.length}개 선택 · 다음` : '건너뛰기'}
            </button>
          )}
          {step === 3 && (
            <button className="som-next" onClick={next}>
              {a.countries.length ? `${a.countries.length}개 선택 · 다음` : '상관없어요 · 다음'}
            </button>
          )}
          {(step === 0 || step === 1) && <span />}
          {step === 4 && submitting && <span style={{ fontSize: 13, color: 'var(--som-muted)' }}>와인을 찾는 중…</span>}
        </div>
      </div>
    </section>
  );
}
