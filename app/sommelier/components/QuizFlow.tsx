'use client';

// 취향 문답 5단계 — 전 단계 공통 문법: 연회백 대형 타이포가 선택 시 와인 색으로 물든다.
// 단일 선택(타입·무게감·가격)은 물든 뒤 자동 진행, 멀티(향미·산지)는 물든 채 유지 + [다음].
import { useState } from 'react';
import {
  BODY_OPTIONS, COUNTRY_OPTIONS, FLAVOR_GROUPS, PRICE_OPTIONS, TYPE_OPTIONS,
  EMPTY_ANSWERS, type QuizAnswers,
} from '../lib/quiz';

const STEP_CODE = [
  'Q.1 — TYPE', 'Q.2 — BODY · 무게감', 'Q.3 — FLAVOR · 향미 (여러 개)',
  'Q.4 — ORIGIN · 산지 (여러 개)', 'Q.5 — PRICE · 가격대',
];

export function QuizFlow({ onSubmit, submitting, onExit }: {
  onSubmit: (a: QuizAnswers) => void;
  submitting: boolean;
  onExit: () => void;
}) {
  const [step, setStep] = useState(0);
  const [a, setA] = useState<QuizAnswers>(EMPTY_ANSWERS);
  const [sel, setSel] = useState<string | null>(null); // 단일 선택 물들기 연출

  const next = () => setStep((s) => Math.min(s + 1, 4));
  const back = () => (step === 0 ? onExit() : setStep((s) => s - 1));
  const toggle = (arr: string[], k: string) => (arr.includes(k) ? arr.filter((x) => x !== k) : [...arr, k]);

  /** 단일 선택 — 색이 물든 뒤 다음으로 (마지막 단계면 제출) */
  const pick = (key: string, apply: () => QuizAnswers, last = false) => {
    if (sel || submitting) return;
    setSel(key);
    const applied = apply();
    setA(applied);
    setTimeout(() => {
      setSel(null);
      if (last) onSubmit(applied); else next();
    }, 420);
  };

  return (
    <section className="som-screen" key={step}>
      <div className="som-brand"><span className="som-lat">CAVE DE VIN</span><span>취향 문답</span></div>
      <div className="som-prog"><i style={{ width: `${((step + 1) / 5) * 100}%` }} /></div>
      <div className="som-q">
        <div className="som-qno som-lat som-rise" style={{ ['--i' as string]: 0 }}>{STEP_CODE[step]}</div>

        {step === 0 && (
          <div className="som-words">
            {TYPE_OPTIONS.filter((o) => o.value).map((o, i) => (
              <button key={String(o.value)}
                className={`som-word som-word-${o.value} som-rise${sel === String(o.value) ? ' sel' : ''}`}
                style={{ ['--i' as string]: i + 1 }}
                onClick={() => pick(String(o.value), () => ({ ...a, type: o.value }))}>
                {o.label}
              </button>
            ))}
            <button className="som-link som-rise" style={{ ['--i' as string]: 5, marginTop: 14 }}
              onClick={() => pick('any', () => ({ ...a, type: null }))}>
              상관없어요
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="som-words">
            {BODY_OPTIONS.filter((o) => o.value).map((o, i) => (
              <button key={String(o.value)}
                className={`som-word som-rise${sel === String(o.value) ? ' sel' : ''}`}
                style={{ ['--i' as string]: i + 1 }}
                onClick={() => pick(String(o.value), () => ({ ...a, body: o.value }))}>
                {o.label}
              </button>
            ))}
            <button className="som-link som-rise" style={{ ['--i' as string]: 4, marginTop: 14 }}
              onClick={() => pick('any', () => ({ ...a, body: null }))}>
              상관없어요
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="som-words">
            {Object.entries(FLAVOR_GROUPS).map(([key, g], i) => (
              <button key={key}
                className={`som-word som-word--md som-rise${a.flavorGroups.includes(key) ? ' on' : ''}`}
                style={{ ['--i' as string]: i + 1 }}
                onClick={() => setA({ ...a, flavorGroups: toggle(a.flavorGroups, key) })}>
                {g.label}
              </button>
            ))}
          </div>
        )}

        {step === 3 && (
          <div className="som-words">
            {Object.entries(COUNTRY_OPTIONS).map(([key, c], i) => (
              <button key={key}
                className={`som-word som-word--md som-rise${a.countries.includes(key) ? ' on' : ''}`}
                style={{ ['--i' as string]: i + 1 }}
                onClick={() => setA({ ...a, countries: toggle(a.countries, key) })}>
                {c.label}
              </button>
            ))}
          </div>
        )}

        {step === 4 && (
          <div className="som-words">
            {PRICE_OPTIONS.filter((o) => o.min != null || o.max != null).map((o, i) => (
              <button key={o.label}
                className={`som-word som-word--md som-rise${sel === o.label ? ' sel' : ''}`}
                style={{ ['--i' as string]: i + 1 }}
                onClick={() => pick(o.label, () => ({ ...a, priceMin: o.min, priceMax: o.max }), true)}>
                {o.label}
              </button>
            ))}
            <button className="som-link som-rise" style={{ ['--i' as string]: 6, marginTop: 14 }}
              onClick={() => pick('any', () => ({ ...a, priceMin: null, priceMax: null }), true)}>
              상관없어요
            </button>
          </div>
        )}

        <div className="som-subrow som-rise" style={{ ['--i' as string]: 10 }}>
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
          {step === 4 && submitting && <span style={{ fontSize: 13, color: 'var(--som-muted)' }}>와인을 찾는 중…</span>}
          {(step === 0 || step === 1) && <span />}
        </div>
      </div>
    </section>
  );
}
