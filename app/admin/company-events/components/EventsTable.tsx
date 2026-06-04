'use client';

import type { CompanyEvent } from '../types';

const COLS_STYLE: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '140px 70px 1fr 1fr 100px',
  alignItems: 'center',
};

function formatDateKR(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}(${days[d.getDay()]})`;
}

type Props = {
  events: CompanyEvent[];
  loading: boolean;
  onEdit: (ev: CompanyEvent) => void;
  onDelete: (id: number) => void;
};

export function EventsTable({ events, loading, onEdit, onDelete }: Props) {
  const todayStr = new Date().toISOString().slice(0, 10);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>로딩 중...</div>;
  }

  if (events.length === 0) {
    return (
      <div style={{
        textAlign: 'center', padding: 60, color: 'var(--text-muted)',
        background: '#fff', borderRadius: 12,
        border: '1px solid rgba(90,21,21,0.06)',
      }}>
        등록된 회사 일정이 없습니다
      </div>
    );
  }

  return (
    <div style={{
      background: '#fff', borderRadius: 12,
      border: '1px solid rgba(90,21,21,0.06)',
      overflow: 'hidden',
    }}>
      <div style={{
        ...COLS_STYLE,
        padding: '10px 16px', background: '#faf8f2',
        borderBottom: '1px solid rgba(90,21,21,0.06)',
        fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)',
      }}>
        <div>날짜</div>
        <div>시간</div>
        <div>일정명</div>
        <div>메모</div>
        <div style={{ textAlign: 'center' }}>관리</div>
      </div>

      {events.map(ev => {
        const isPast = ev.meeting_date?.slice(0, 10) < todayStr;
        return (
          <div
            key={ev.id}
            style={{
              ...COLS_STYLE,
              padding: '12px 16px',
              borderBottom: '1px solid #f5f3ed',
              opacity: isPast ? 0.5 : 1,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              {formatDateKR(ev.meeting_date)}
            </div>
            <div style={{ fontSize: 13, color: '#666' }}>
              {ev.meeting_time?.slice(0, 5) || '-'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
              {ev.purpose || '-'}
            </div>
            <div style={{
              fontSize: 12, color: 'var(--text-muted)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {ev.notes || '-'}
            </div>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
              <button
                onClick={() => onEdit(ev)}
                style={{
                  padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(90,21,21,0.1)',
                  background: '#fff', color: 'var(--action)', fontSize: 11, cursor: 'pointer', fontWeight: 600,
                }}
              >
                수정
              </button>
              <button
                onClick={() => onDelete(ev.id)}
                style={{
                  padding: '4px 10px', borderRadius: 6, border: '1px solid #ffcdd2',
                  background: '#fff', color: 'var(--status-danger)', fontSize: 11, cursor: 'pointer',
                }}
              >
                삭제
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
