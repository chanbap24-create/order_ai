'use client';

export function EmptyState({ todayLabel }: { todayLabel: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: '#a8a098', fontSize: 14 }}>
      <svg
        width="48" height="48" viewBox="0 0 24 24" fill="none"
        stroke="#ddd" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
        style={{ marginBottom: 16 }}
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8" />
      </svg>
      <div style={{ fontWeight: 600, color: '#8a8580', marginBottom: 4 }}>오늘 미팅 없음</div>
      <div>{todayLabel} 예정된 미팅이 없습니다</div>
    </div>
  );
}

export function BriefingToast({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div style={{
      position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)',
      background: '#38a169', color: '#fff', padding: '12px 24px', borderRadius: 8,
      fontSize: 14, fontWeight: 500, zIndex: 2000,
      boxShadow: '0 4px 12px rgba(90,21,21,0.1)',
    }}>
      {message}
    </div>
  );
}
