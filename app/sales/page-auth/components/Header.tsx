'use client';

type Props = {
  currentManager: string;
  isAdmin: boolean;
  showPwChange: boolean;
  onTogglePwChange: () => void;
  onLogout: () => void;
};

export function Header({ currentManager, isAdmin, showPwChange, onTogglePwChange, onLogout }: Props) {
  return (
    <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div>
        <h1 style={{
          fontSize: '1.35rem', fontWeight: 700, color: '#2c1810', margin: 0,
          fontFamily: "'Cormorant Garamond', serif", letterSpacing: '0.02em',
        }}>
          Sales Support
        </h1>
        <p style={{ fontSize: 13, color: '#8a8580', margin: '4px 0 0' }}>
          {currentManager}{isAdmin ? ' (관리자)' : ''} · 영업 지원 시스템
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <button
          onClick={onTogglePwChange}
          style={{
            padding: '6px 12px', borderRadius: 8,
            border: showPwChange ? '1.5px solid rgba(90,21,21,0.2)' : '1.5px solid rgba(90,21,21,0.08)',
            background: showPwChange ? 'rgba(90,21,21,0.04)' : 'transparent',
            fontSize: 11, fontWeight: 600,
            color: showPwChange ? '#5A1515' : '#8a8580',
            cursor: 'pointer', transition: 'all 0.2s ease', whiteSpace: 'nowrap',
          }}
        >
          PW
        </button>
        <button
          onClick={onLogout}
          style={{
            padding: '6px 12px', borderRadius: 8,
            border: '1.5px solid rgba(90,21,21,0.08)', background: 'transparent',
            fontSize: 11, fontWeight: 600, color: '#8a8580',
            cursor: 'pointer', transition: 'all 0.2s ease', whiteSpace: 'nowrap',
          }}
        >
          로그아웃
        </button>
      </div>
    </div>
  );
}
