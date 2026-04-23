'use client';

import { useCallback, useEffect, useState } from 'react';
import type { CompanyEvent } from '../types';

type ApiMeeting = CompanyEvent & { [k: string]: unknown };

export function useCompanyEvents(onToast: (msg: string) => void) {
  const [events, setEvents] = useState<CompanyEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      const dateFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
      const dateTo = new Date(now.getFullYear(), now.getMonth() + 6, 0).toISOString().slice(0, 10);
      const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo, manager: '__company__' });
      const res = await fetch(`/api/sales/meetings?${params}`);
      const json = await res.json();
      setEvents((json.meetings || []).filter((m: ApiMeeting) => m.is_company_event));
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  const saveEvent = async (args: { id: number | null; date: string; time: string; title: string; notes: string }) => {
    if (!args.date || !args.title.trim()) {
      onToast('날짜와 일정명은 필수입니다.');
      return false;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        meeting_date: args.date,
        meeting_time: args.time || null,
        meeting_type: 'company',
        purpose: args.title.trim(),
        notes: args.notes.trim() || null,
        manager: '__company__',
        is_company_event: true,
      };
      if (args.id) body.id = args.id;

      const res = await fetch('/api/sales/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.error) { onToast('오류: ' + json.error); return false; }
      onToast(args.id ? '일정이 수정되었습니다.' : '일정이 등록되었습니다.');
      loadEvents();
      return true;
    } catch {
      onToast('저장에 실패했습니다.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const deleteEvent = async (id: number) => {
    if (!confirm('이 일정을 삭제하시겠습니까?')) return;
    try {
      await fetch(`/api/sales/meetings?id=${id}`, { method: 'DELETE' });
      onToast('일정이 삭제되었습니다.');
      loadEvents();
    } catch {
      onToast('삭제에 실패했습니다.');
    }
  };

  return { events, loading, saving, saveEvent, deleteEvent };
}
