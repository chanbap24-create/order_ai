'use client';

import type { WineRegion } from '../types';
import { COUNTRIES } from '../constants';

type Props = {
  item: WineRegion;
  isNew: boolean;
  saving: boolean;
  onChange: (item: WineRegion) => void;
  onClose: () => void;
  onSave: () => void;
};

const FIELDS: { key: keyof WineRegion; label: string; required?: boolean; type?: string }[] = [
  { key: 'country', label: '국가', required: true, type: 'select' },
  { key: 'major_region', label: '대지역', required: true },
  { key: 'sub_region', label: '서브리전' },
  { key: 'appellation', label: 'AOC/DO/AVA' },
  { key: 'cru_vineyard', label: '크뤼/포도밭' },
  { key: 'classification', label: '등급' },
  { key: 'grape_varieties', label: '주요 품종' },
  { key: 'notes', label: '비고' },
];

export function RegionEditModal({ item, isNew, saving, onChange, onClose, onSave }: Props) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(90,21,21,0.4)', zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 10, padding: 24,
          width: '100%', maxWidth: 480, maxHeight: '80vh', overflowY: 'auto',
          boxShadow: '0 8px 32px rgba(90,21,21,0.15)',
        }}
      >
        <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
          {isNew ? '새 산지 추가' : '산지 수정'}
        </h3>
        {FIELDS.map(f => (
          <div key={f.key} style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 4 }}>
              {f.label} {f.required && <span style={{ color: '#c44' }}>*</span>}
            </label>
            {f.type === 'select' ? (
              <select
                value={String(item[f.key] || '')}
                onChange={e => onChange({ ...item, [f.key]: e.target.value } as WineRegion)}
                style={{
                  width: '100%', height: 36, padding: '0 10px', fontSize: 14,
                  border: '1px solid var(--gray-200)', borderRadius: 6, boxSizing: 'border-box',
                  outline: 'none', background: '#fff',
                }}
              >
                {COUNTRIES.filter(c => c.value).map(c => (
                  <option key={c.value} value={c.value}>{c.flag} {c.label} ({c.value})</option>
                ))}
              </select>
            ) : (
              <input
                value={String(item[f.key] || '')}
                onChange={e => onChange({ ...item, [f.key]: e.target.value || null } as WineRegion)}
                style={{
                  width: '100%', height: 36, padding: '0 10px', fontSize: 14,
                  border: '1px solid var(--gray-200)', borderRadius: 6, boxSizing: 'border-box', outline: 'none',
                }}
              />
            )}
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{ padding: '8px 16px', fontSize: 13, border: '1px solid var(--gray-300)', borderRadius: 6, background: '#fff', cursor: 'pointer', color: 'var(--text-tertiary)' }}
          >
            취소
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            style={{
              padding: '8px 20px', fontSize: 13, border: 'none', borderRadius: 6,
              background: 'var(--action)', color: '#fff', cursor: saving ? 'default' : 'pointer',
              fontWeight: 600, opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
