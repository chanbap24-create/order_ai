'use client';

// 연령대·성별 — 직원이 손님을 보고 대략 고름(단골 카드 전용, 손님 화면엔 안 보임). 고르면 바로 저장, '선택 안 함'이면 해제.
// 드롭다운은 기본 select — 휴대폰에선 OS 선택 시트로 열림. 옛 동의 손님은 잠금(새 동의를 받아야 기록 가능).
import { useState } from 'react';
import { AGE_BANDS, GENDERS, type AgeBand, type CustomerCardData, type Gender } from '../types';

type Profile = CustomerCardData['profile'];

function Select<K extends string>({ label, options, value, disabled, onPick }: {
  label: string; options: readonly (readonly [K, string])[]; value: K | null; disabled: boolean; onPick: (v: K | null) => void;
}) {
  return (
    <label style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{label}</span>
      <span style={{ position: 'relative', display: 'block' }}>
        <select value={value ?? ''} disabled={disabled} onChange={(e) => onPick((e.target.value || null) as K | null)}
          style={{
            width: '100%', boxSizing: 'border-box', appearance: 'none', WebkitAppearance: 'none',
            padding: '8px 22px 8px 0', fontSize: 16, // 16px = iOS 확대 방지
            border: 'none', borderBottom: '1px solid var(--border-default)', borderRadius: 0, background: 'transparent',
            color: value ? 'var(--text-primary)' : 'var(--text-tertiary)', fontWeight: value ? 600 : 400,
            cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.45 : 1, outline: 'none',
          }}>
          <option value="">선택 안 함</option>
          {options.map(([k, text]) => <option key={k} value={k}>{text}</option>)}
        </select>
        <svg aria-hidden width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
          style={{ position: 'absolute', right: 2, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </span>
    </label>
  );
}

export function ProfileEditor({ profile, onSave }: {
  profile: Profile;
  onSave: (p: { ageBand: AgeBand | null; gender: Gender | null }) => Promise<boolean>;
}) {
  const [p, setP] = useState({ ageBand: profile.ageBand, gender: profile.gender });
  const save = async (next: typeof p) => {
    const prev = p;
    setP(next); // 바로 반영, 실패하면 되돌림
    if (!(await onSave(next))) setP(prev);
  };
  return (
    <div style={{ paddingTop: 12 }}>
      <div style={{ display: 'flex', gap: 20 }}>
        <Select label="연령대" options={AGE_BANDS} value={p.ageBand} disabled={!profile.canEdit} onPick={(v) => void save({ ...p, ageBand: v })} />
        <Select label="성별" options={GENDERS} value={p.gender} disabled={!profile.canEdit} onPick={(v) => void save({ ...p, gender: v })} />
      </div>
      {(profile.meta || !profile.canEdit) && (
        <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
          {profile.canEdit ? profile.meta : '이전 동의 손님이라 기록할 수 없어요 — 손님 정보 화면에서 성함·번호를 다시 입력하고 동의를 받으면 열려요'}
        </p>
      )}
    </div>
  );
}
