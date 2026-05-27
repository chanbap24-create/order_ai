'use client';

import { useCallback, useEffect, useState } from 'react';
import type { CompanyEvent } from '../company-events/types';
import { useCompanyEvents } from '../company-events/hooks/useCompanyEvents';
import { EventsTable } from '../company-events/components/EventsTable';
import { EventFormModal } from '../company-events/components/EventFormModal';

export default function CompanyEventsTab() {
  const [toast, setToast] = useState('');
  const showToast = useCallback((msg: string) => setToast(msg), []);
  const { events, loading, saving, saveEvent, deleteEvent } = useCompanyEvents(showToast);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formDate, setFormDate] = useState('');
  const [formTime, setFormTime] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formNotes, setFormNotes] = useState('');

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3000);
    return () => clearTimeout(t);
  }, [toast]);

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

  const handleSave = async () => {
    const ok = await saveEvent({ id: editingId, date: formDate, time: formTime, title: formTitle, notes: formNotes });
    if (ok) setShowForm(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>회사 일정 관리</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            등록된 일정은 모든 세일즈 담당자의 달력에 표시됩니다
          </div>
        </div>
        <button
          onClick={openCreate}
          style={{
            padding: '8px 16px', borderRadius: 8, border: 'none',
            background: 'var(--action)', color: '#fff', fontSize: 13, fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          + 일정 등록
        </button>
      </div>

      <EventsTable events={events} loading={loading} onEdit={openEdit} onDelete={deleteEvent} />

      {showForm && (
        <EventFormModal
          editingId={editingId}
          formDate={formDate}
          formTime={formTime}
          formTitle={formTitle}
          formNotes={formNotes}
          saving={saving}
          onDateChange={setFormDate}
          onTimeChange={setFormTime}
          onTitleChange={setFormTitle}
          onNotesChange={setFormNotes}
          onClose={() => setShowForm(false)}
          onSave={handleSave}
        />
      )}

      {toast && (
        <div style={{
          position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)',
          background: toast.startsWith('오류') ? '#c53030' : '#38a169',
          color: '#fff', padding: '12px 24px', borderRadius: 8,
          fontSize: 14, fontWeight: 500, zIndex: 2000,
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
