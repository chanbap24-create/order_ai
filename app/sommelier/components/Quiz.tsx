'use client';

// 손님 취향 단계형 문답 — 타입 → 바디 → 향미(멀티) → 가격대 → 용도.
// KREAM 문법: 순백·헤어라인·테두리 칩(채운 배경 금지), 모바일 우선.
import { useState } from 'react';
import {
  BODY_OPTIONS, FLAVOR_GROUPS, OCCASION_OPTIONS, PRICE_OPTIONS, TYPE_OPTIONS,
  EMPTY_ANSWERS, type QuizAnswers,
} from '../lib/quiz';

const STEPS = ['타입', '스타일', '향미', '가격대', '용도'] as const;

export function Quiz({ onSubmit, submitting }: {
  onSubmit: (answers: QuizAnswers) => void;
  submitting: boolean;
}) {
  const [step, setStep] = useState(0);
  const [a, setA] = useState<QuizAnswers>(EMPTY_ANSWERS);

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const prev = () => setStep((s) => Math.max(s - 1, 0));
  const last = step === STEPS.length - 1;

  return (
    <div>
      {/* 진행 표시 — 헤어라인 + 단계 텍스트 */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', marginBottom: 20 }}>
        {STEPS.map((label, i) => (
          <button key={label} onClick={() => i < step && setStep(i)} style={{
            flex: 1, padding: '10px 0', border: 'none', background: 'none', fontSize: 12.5,
            fontWeight: i === step ? 700 : 400,
            color: i === step ? 'var(--text-primary)' : i < step ? 'var(--text-secondary)' : 'var(--text-muted)',
            borderBottom: i === step ? '2px solid var(--action)' : '2px solid transparent',
            cursor: i < step ? 'pointer' : 'default', marginBottom: -1,
          }}>{label}</button>
        ))}
      </div>

      {step === 0 && (
        <StepBox title="어떤 와인을 찾으세요?">
          {TYPE_OPTIONS.map((o) => (
            <ChoiceChip key={String(o.value)} label={o.label} active={a.type === o.value}
              onClick={() => { setA({ ...a, type: o.value }); next(); }} />
          ))}
        </StepBox>
      )}

      {step === 1 && (
        <StepBox title="어떤 스타일을 좋아하세요?">
          {BODY_OPTIONS.map((o) => (
            <ChoiceChip key={String(o.value)} label={o.label} desc={o.desc} active={a.body === o.value}
              onClick={() => { setA({ ...a, body: o.value }); next(); }} />
          ))}
        </StepBox>
      )}

      {step === 2 && (
        <StepBox title="끌리는 향미를 모두 골라주세요" sub="여러 개 선택 가능">
          {Object.entries(FLAVOR_GROUPS).map(([key, g]) => {
            const on = a.flavorGroups.includes(key);
            return (
              <ChoiceChip key={key} label={g.label} desc={g.desc} active={on}
                onClick={() => setA({
                  ...a,
                  flavorGroups: on ? a.flavorGroups.filter((k) => k !== key) : [...a.flavorGroups, key],
                })} />
            );
          })}
        </StepBox>
      )}

      {step === 3 && (
        <StepBox title="생각하시는 가격대는요?" sub="판매가 기준">
          {PRICE_OPTIONS.map((o) => {
            const active = a.priceMin === o.min && a.priceMax === o.max;
            return (
              <ChoiceChip key={o.label} label={o.label} active={active}
                onClick={() => { setA({ ...a, priceMin: o.min, priceMax: o.max }); next(); }} />
            );
          })}
        </StepBox>
      )}

      {step === 4 && (
        <StepBox title="어떤 자리에서 드시나요?">
          {OCCASION_OPTIONS.map((o) => (
            <ChoiceChip key={String(o.value)} label={o.label} desc={o.desc} active={a.occasion === o.value}
              onClick={() => setA({ ...a, occasion: o.value })} />
          ))}
        </StepBox>
      )}

      {/* 하단 내비게이션 */}
      <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
        {step > 0 && (
          <button onClick={prev} style={{
            height: 48, padding: '0 20px', borderRadius: 8, fontSize: 14, fontWeight: 600,
            border: '1px solid var(--border-default)', background: 'var(--surface)', color: 'var(--text-secondary)', cursor: 'pointer',
          }}>이전</button>
        )}
        {step === 2 && (
          <button onClick={next} style={navNextStyle}>
            {a.flavorGroups.length > 0 ? `${a.flavorGroups.length}개 선택 · 다음` : '건너뛰기'}
          </button>
        )}
        {last && (
          <button onClick={() => onSubmit(a)} disabled={submitting} style={{ ...navNextStyle, opacity: submitting ? 0.6 : 1 }}>
            {submitting ? '찾는 중…' : '와인 추천받기'}
          </button>
        )}
      </div>
    </div>
  );
}

const navNextStyle: React.CSSProperties = {
  flex: 1, height: 48, borderRadius: 8, fontSize: 15, fontWeight: 700,
  border: 'none', background: 'var(--action)', color: 'var(--text-on-primary)', cursor: 'pointer',
};

function StepBox({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{title}</div>
      {sub && <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginBottom: 4 }}>{sub}</div>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>{children}</div>
    </div>
  );
}

/** 테두리 칩 — 선택 시 블랙 테두리+볼드(채운 배경 칩 금지 문법) */
function ChoiceChip({ label, desc, active, onClick }: {
  label: string; desc?: string; active: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick} style={{
      padding: desc ? '10px 14px' : '12px 18px', borderRadius: 10, textAlign: 'left', cursor: 'pointer',
      border: active ? '1.5px solid var(--action)' : '1px solid var(--border-default)',
      background: 'var(--surface)', minWidth: desc ? 150 : 0,
    }}>
      <div style={{ fontSize: 14.5, fontWeight: active ? 700 : 500, color: 'var(--text-primary)' }}>{label}</div>
      {desc && <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 2 }}>{desc}</div>}
    </button>
  );
}
