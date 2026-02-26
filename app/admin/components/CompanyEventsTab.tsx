'use client';

import { useState, useEffect, useCallback } from 'react';

interface CompanyEvent {
  id: number;
  meeting_date: string;
  meeting_time: string | null;
  purpose: string | null;
  notes: string | null;
  is_company_event: boolean;
}

export default function CompanyEventsTab() {
  const [events, setEvents] = useState<CompanyEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');

  // 폼 상태
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formDate, setFormDate] = useState('');
  const [formTime, setFormTime] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      const dateFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
      const dateTo = new Date(now.getFullYear(), now.getMonth() + 6, 0).toISOString().slice(0, 10);
      const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo, manager: '__company__' });
      const res = await fetch(`/api/sales/meetings?${params}`);
      const json = await res.json();
      setEvents((json.meetings || []).filter((m: any) => m.is_company_event));
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  const openCreate = () => {
    setEditingId(null);
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormTime('');
    setFormTitle('');
    setFormNotes('');
    setShowForm(true);
  };

  const openEdit = (ev: CompanyEvent) => {
    setEditingId(ev.id);
    setFormDate(ev.meeting_date?.slice(0, 10) || '');
    setFormTime(ev.meeting_time || '');
    setFormTitle(ev.purpose || '');
    setFormNotes(ev.notes || '');
    setShowForm(true);
  };

  const saveEvent = async () => {
    if (!formDate || !formTitle.trim()) {
      setToast('날짜와 일정명은 필수입니다.');
      return;
    }
    setSaving(true);
    try {
      const body: any = {
        meeting_date: formDate,
        meeting_time: formTime || null,
        meeting_type: 'company',
        purpose: formTitle.trim(),
        notes: formNotes.trim() || null,
        manager: '__company__',
        is_company_event: true,
      };
      if (editingId) body.id = editingId;

      const res = await fetch('/api/sales/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.error) { setToast('오류: ' + json.error); return; }
      setShowForm(false);
      setToast(editingId ? '일정이 수정되었습니다.' : '일정이 등록되었습니다.');
      loadEvents();
    } catch {
      setToast('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const deleteEvent = async (id: number) => {
    if (!confirm('이 일정을 삭제하시겠습니까?')) return;
    try {
      await fetch(`/api/sales/meetings?id=${id}`, { method: 'DELETE' });
      setToast('일정이 삭제되었습니다.');
      loadEvents();
    } catch {
      setToast('삭제에 실패했습니다.');
    }
  };

  const formatDateKR = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}(${days[d.getDay()]})`;
  };

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div>
      {/* 헤더 */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 16,
      }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#2c1810' }}>회사 일정 관리</div>
          <div style={{ fontSize: 12, color: '#a8a098', marginTop: 2 }}>
            등록된 일정은 모든 세일즈 담당자의 달력에 표시됩니다
          </div>
        </div>
        <button onClick={openCreate} style={{
          padding: '8px 16px', borderRadius: 8, border: 'none',
          background: '#5A1515', color: '#fff', fontSize: 13, fontWeight: 600,
          cursor: 'pointer',
        }}>+ 일정 등록</button>
      </div>

      {/* 일정 목록 */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#a8a098' }}>로딩 중...</div>
      ) : events.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 60, color: '#a8a098',
          background: '#fff', borderRadius: 12,
          border: '1px solid rgba(90,21,21,0.06)',
        }}>
          등록된 회사 일정이 없습니다
        </div>
      ) : (
        <div style={{
          background: '#fff', borderRadius: 12,
          border: '1px solid rgba(90,21,21,0.06)',
          overflow: 'hidden',
        }}>
          {/* 테이블 헤더 */}
          <div style={{
            display: 'grid', gridTemplateColumns: '140px 70px 1fr 1fr 100px',
            padding: '10px 16px', background: '#faf8f2',
            borderBottom: '1px solid rgba(90,21,21,0.06)',
            fontSize: 12, fontWeight: 600, color: '#8a8580',
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
              <div key={ev.id} style={{
                display: 'grid', gridTemplateColumns: '140px 70px 1fr 1fr 100px',
                padding: '12px 16px', alignItems: 'center',
                borderBottom: '1px solid #f5f3ed',
                opacity: isPast ? 0.5 : 1,
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#2c1810' }}>
                  {formatDateKR(ev.meeting_date)}
                </div>
                <div style={{ fontSize: 13, color: '#666' }}>
                  {ev.meeting_time?.slice(0, 5) || '-'}
                </div>
                <div style={{ fontSize: 13, color: '#2c1810', fontWeight: 500 }}>
                  {ev.purpose || '-'}
                </div>
                <div style={{
                  fontSize: 12, color: '#a8a098',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {ev.notes || '-'}
                </div>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                  <button onClick={() => openEdit(ev)} style={{
                    padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(90,21,21,0.1)',
                    background: '#fff', color: '#5A1515', fontSize: 11, cursor: 'pointer', fontWeight: 600,
                  }}>수정</button>
                  <button onClick={() => deleteEvent(ev.id)} style={{
                    padding: '4px 10px', borderRadius: 6, border: '1px solid #ffcdd2',
                    background: '#fff', color: '#c62828', fontSize: 11, cursor: 'pointer',
                  }}>삭제</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 생성/수정 모달 */}
      {showForm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
        }} onClick={() => setShowForm(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#fff', borderRadius: 16, padding: '24px 20px',
            width: '100%', maxWidth: 420,
          }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#2c1810', marginBottom: 20 }}>
              {editingId ? '회사 일정 수정' : '회사 일정 등록'}
            </div>

            <label style={{ fontSize: 12, fontWeight: 600, color: '#8a8580', display: 'block', marginBottom: 6 }}>
              일정명 <span style={{ color: '#c62828' }}>*</span>
            </label>
            <input
              type="text"
              placeholder="예: 수입 시음회, 전사 워크숍..."
              value={formTitle}
              onChange={e => setFormTitle(e.target.value)}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8,
                border: '1px solid rgba(90,21,21,0.08)', fontSize: 16, outline: 'none',
                marginBottom: 14, boxSizing: 'border-box',
              }}
            />

            <label style={{ fontSize: 12, fontWeight: 600, color: '#8a8580', display: 'block', marginBottom: 6 }}>
              날짜 <span style={{ color: '#c62828' }}>*</span>
            </label>
            <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} style={{
              width: '100%', padding: '10px 12px', borderRadius: 8,
              border: '1px solid rgba(90,21,21,0.08)', fontSize: 16, outline: 'none',
              marginBottom: 14, boxSizing: 'border-box',
            }} />

            <label style={{ fontSize: 12, fontWeight: 600, color: '#8a8580', display: 'block', marginBottom: 6 }}>
              시간 <span style={{ fontWeight: 400, color: '#bbb' }}>(선택)</span>
            </label>
            <input type="time" value={formTime} onChange={e => setFormTime(e.target.value)} style={{
              width: '100%', padding: '10px 12px', borderRadius: 8,
              border: '1px solid rgba(90,21,21,0.08)', fontSize: 16, outline: 'none',
              marginBottom: 14, boxSizing: 'border-box',
            }} />

            <label style={{ fontSize: 12, fontWeight: 600, color: '#8a8580', display: 'block', marginBottom: 6 }}>메모</label>
            <textarea
              value={formNotes}
              onChange={e => setFormNotes(e.target.value)}
              placeholder="추가 정보..."
              rows={3}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8,
                border: '1px solid rgba(90,21,21,0.08)', fontSize: 16, outline: 'none',
                marginBottom: 20, boxSizing: 'border-box', resize: 'vertical',
                fontFamily: 'inherit',
              }}
            />

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowForm(false)} style={{
                flex: 1, padding: '12px', borderRadius: 8, border: '1px solid rgba(90,21,21,0.08)',
                background: '#fff', color: '#8a8580', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}>취소</button>
              <button onClick={saveEvent} disabled={!formTitle.trim() || !formDate || saving} style={{
                flex: 1, padding: '12px', borderRadius: 8, border: 'none',
                background: (!formTitle.trim() || !formDate || saving) ? '#ccc' : 'linear-gradient(135deg, #5A1515, #8B2252)',
                color: '#fff', fontSize: 14, fontWeight: 600,
                cursor: (!formTitle.trim() || !formDate || saving) ? 'default' : 'pointer',
              }}>{saving ? '저장 중...' : '저장'}</button>
            </div>
          </div>
        </div>
      )}

      {/* 토스트 */}
      {toast && (
        <div style={{
          position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)',
          background: toast.startsWith('오류') ? '#c53030' : '#38a169',
          color: '#fff', padding: '12px 24px', borderRadius: 8,
          fontSize: 14, fontWeight: 500, zIndex: 2000,
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        }}>{toast}</div>
      )}
    </div>
  );
}
