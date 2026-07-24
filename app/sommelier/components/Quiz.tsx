'use client';

// 손님 취향 단계형 문답 — 타입 → 스타일 → 향미(멀티) → 국가(멀티) → 가격대.
// 손님과 함께 보는 화면: 큰 질문 타이포 + 단계 전환·칩 스태거 애니메이션.
import { useState } from 'react';
import {
  BODY_OPTIONS, COUNTRY_OPTIONS, FLAVOR_GROUPS, PRICE_OPTIONS, TYPE_OPTIONS,
  EMPTY_ANSWERS, type QuizAnswers,
} from '../lib/quiz';

const STEPS = ['타입', '스타일', '향미', '국가', '가격대'] as const;

export function Quiz({ customerName, onSubmit, submitting }: {
  customerName: string;
  onSubmit: (answers: QuizAnswers) => void;
  submitting: boolean;
}) {
  const [step, setStep] = useState(0);
  const [a, setA] = useState<QuizAnswers>(EMPTY_ANSWERS);

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const prev = () => setStep((s) => Math.max(s - 1, 0));
  const last = step === STEPS.length - 1;
  const multiStep = step === 2 || step === 3; // 멀티 선택 단계는 [다음] 버튼으로 진행

  return (
    <div>
      {/* 진행 바 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <div style={{ flex: 1, height: 3, background: 'var(--border-subtle)', borderRadius: 2, overflow: 'hidden' }}>
          <div className="som-progress" style={{
            width: `${((step + 1) / STEPS.length) * 100}%`, height: '100%', background: 'var(--action)',
          }} />
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
          {step + 1}/{STEPS.length}
        </span>
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginBottom: 22 }}>
        {customerName} 님의 취향 찾기
      </div>

      {/* key=step — 단계가 바뀔 때마다 재마운트되며 등장 애니메이션 */}
      <div key={step}>
        {step === 0 && (
          <StepBox title="어떤 와인을 찾으세요?">
            {TYPE_OPTIONS.map((o, i) => (
              <ChoiceChip key={String(o.value)} i={i} label={o.label} active={a.type === o.value}
                onClick={() => { setA({ ...a, type: o.value }); next(); }} />
            ))}
          </StepBox>
        )}

        {step === 1 && (
          <StepBox title="어떤 스타일을 좋아하세요?">
            {BODY_OPTIONS.map((o, i) => (
              <ChoiceChip key={String(o.value)} i={i} label={o.label} desc={o.desc} active={a.body === o.value}
                onClick={() => { setA({ ...a, body: o.value }); next(); }} />
            ))}
          </StepBox>
        )}

        {step === 2 && (
          <StepBox title="끌리는 향미를 모두 골라주세요" sub="여러 개 선택할 수 있어요">
            {Object.entries(FLAVOR_GROUPS).map(([key, g], i) => {
              const on = a.flavorGroups.includes(key);
              return (
                <ChoiceChip key={key} i={i} label={g.label} desc={g.desc} active={on}
                  onClick={() => setA({
                    ...a,
                    flavorGroups: on ? a.flavorGroups.filter((k) => k !== key) : [...a.flavorGroups, key],
                  })} />
              );
            })}
          </StepBox>
        )}

        {step === 3 && (
          <StepBox title="선호하는 산지가 있으세요?" sub="여러 개 선택할 수 있어요 · 없으면 바로 다음으로">
            {Object.entries(COUNTRY_OPTIONS).map(([key, c], i) => {
              const on = a.countries.includes(key);
              return (
                <ChoiceChip key={key} i={i} label={c.label} desc={c.desc} active={on}
                  onClick={() => setA({
                    ...a,
                    countries: on ? a.countries.filter((k) => k !== key) : [...a.countries, key],
                  })} />
              );
            })}
          </StepBox>
        )}

        {step === 4 && (
          <StepBox title="생각하시는 가격대는요?">
            {PRICE_OPTIONS.map((o, i) => {
              const active = a.priceMin === o.min && a.priceMax === o.max;
              return (
                <ChoiceChip key={o.label} i={i} label={o.label} active={active}
                  onClick={() => setA({ ...a, priceMin: o.min, priceMax: o.max })} />
              );
            })}
          </StepBox>
        )}
      </div>

      {/* 하단 내비게이션 */}
      <div style={{ display: 'flex', gap: 8, marginTop: 28 }}>
        {step > 0 && (
          <button onClick={prev} className="som-cta" style={{
            height: 50, padding: '0 20px', borderRadius: 10, fontSize: 14, fontWeight: 600,
            border: '1px solid var(--border-default)', background: 'var(--surface)', color: 'var(--text-secondary)', cursor: 'pointer',
          }}>이전</button>
        )}
        {multiStep && (
          <button onClick={next} className="som-cta" style={navNextStyle}>
            {step === 2
              ? (a.flavorGroups.length ? `${a.flavorGroups.length}개 선택 · 다음` : '건너뛰기')
              : (a.countries.length ? `${a.countries.length}개 선택 · 다음` : '상관없어요 · 다음')}
          </button>
        )}
        {last && (
          <button onClick={() => onSubmit(a)} disabled={submitting} className="som-cta"
            style={{ ...navNextStyle, opacity: submitting ? 0.6 : 1 }}>
            {submitting ? '와인을 찾는 중…' : '추천 와인 보기'}
          </button>
        )}
      </div>
    </div>
  );
}

const navNextStyle: React.CSSProperties = {
  flex: 1, height: 50, borderRadius: 10, fontSize: 15, fontWeight: 700,
  border: 'none', background: 'var(--action)', color: 'var(--text-on-primary)', cursor: 'pointer',
};

function StepBox({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="som-up" style={{
        ['--i' as string]: 0,
        fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.35,
      }}>{title}</div>
      {sub && (
        <div className="som-up" style={{ ['--i' as string]: 1, fontSize: 13, color: 'var(--text-tertiary)', marginTop: 5 }}>
          {sub}
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9, marginTop: 18 }}>{children}</div>
    </div>
  );
}

/** 테두리 칩 — 선택 시 블랙 테두리+볼드. 등장 시 순차(스태거) 페이드업 */
function ChoiceChip({ i, label, desc, active, onClick }: {
  i: number; label: string; desc?: string; active: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="som-up som-chip" style={{
      ['--i' as string]: i + 2,
      padding: desc ? '11px 15px' : '13px 20px', borderRadius: 12, textAlign: 'left', cursor: 'pointer',
      border: active ? '1.5px solid var(--action)' : '1px solid var(--border-default)',
      background: 'var(--surface)', minWidth: desc ? 152 : 0,
    }}>
      <div style={{ fontSize: 15, fontWeight: active ? 700 : 500, color: 'var(--text-primary)' }}>
        {active ? '✓ ' : ''}{label}
      </div>
      {desc && <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 2 }}>{desc}</div>}
    </button>
  );
}
