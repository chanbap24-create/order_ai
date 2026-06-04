'use client';

type Props = {
  editingId: number | null;
  formDate: string;
  formTime: string;
  formTitle: string;
  formNotes: string;
  saving: boolean;
  onDateChange: (v: string) => void;
  onTimeChange: (v: string) => void;
  onTitleChange: (v: string) => void;
  onNotesChange: (v: string) => void;
  onClose: () => void;
  onSave: () => void;
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 8,
  border: '1px solid rgba(90,21,21,0.08)', fontSize: 16, outline: 'none',
  marginBottom: 14, boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)',
  display: 'block', marginBottom: 6,
};

export function EventFormModal(p: Props) {
  const disabled = !p.formTitle.trim() || !p.formDate || p.saving;

  return (
    <div
      onClick={p.onClose}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.5)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 16, padding: '24px 20px', width: '100%', maxWidth: 420 }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20 }}>
          {p.editingId ? '회사 일정 수정' : '회사 일정 등록'}
        </div>

        <label style={labelStyle}>
          일정명 <span style={{ color: '#c62828' }}>*</span>
        </label>
        <input
          type="text"
          placeholder="예: 수입 시음회, 전사 워크숍..."
          value={p.formTitle}
          onChange={e => p.onTitleChange(e.target.value)}
          style={inputStyle}
        />

        <label style={labelStyle}>
          날짜 <span style={{ color: '#c62828' }}>*</span>
        </label>
        <input type="date" value={p.formDate} onChange={e => p.onDateChange(e.target.value)} style={inputStyle} />

        <label style={labelStyle}>
          시간 <span style={{ fontWeight: 400, color: '#bbb' }}>(선택)</span>
        </label>
        <input type="time" value={p.formTime} onChange={e => p.onTimeChange(e.target.value)} style={inputStyle} />

        <label style={labelStyle}>메모</label>
        <textarea
          value={p.formNotes}
          onChange={e => p.onNotesChange(e.target.value)}
          placeholder="추가 정보..."
          rows={3}
          style={{ ...inputStyle, marginBottom: 20, resize: 'vertical', fontFamily: 'inherit' }}
        />

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={p.onClose}
            style={{
              flex: 1, padding: '12px', borderRadius: 8,
              border: '1px solid rgba(90,21,21,0.08)',
              background: '#fff', color: 'var(--text-tertiary)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >
            취소
          </button>
          <button
            onClick={p.onSave}
            disabled={disabled}
            style={{
              flex: 1, padding: '12px', borderRadius: 8, border: 'none',
              background: disabled ? '#ccc' : 'linear-gradient(135deg, var(--action), #8B2252)',
              color: '#fff', fontSize: 14, fontWeight: 600,
              cursor: disabled ? 'default' : 'pointer',
            }}
          >
            {p.saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
