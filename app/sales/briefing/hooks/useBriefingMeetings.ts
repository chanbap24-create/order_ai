'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Meeting } from '../types';

type Args = {
  todayStr: string;
  currentManager: string;
  isAdmin: boolean;
  onToast: (msg: string) => void;
};

export function useBriefingMeetings({ todayStr, currentManager, isAdmin, onToast }: Args) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(false);
  const [generatingId, setGeneratingId] = useState<number | null>(null);

  const loadToday = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ date_from: todayStr, date_to: todayStr });
      if (!isAdmin) params.set('manager', currentManager);
      const res = await fetch(`/api/sales/meetings?${params}`);
      const json = await res.json();
      setMeetings(json.meetings || []);
    } catch {
      setMeetings([]);
    } finally {
      setLoading(false);
    }
  }, [todayStr, isAdmin, currentManager]);

  useEffect(() => { loadToday(); }, [loadToday]);

  const generateBriefing = useCallback(async (meeting: Meeting) => {
    setGeneratingId(meeting.id);
    try {
      const res = await fetch('/api/sales/meetings/briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meeting_id: meeting.id, client_code: meeting.client_code }),
      });
      const json = await res.json();
      if (json.error) { onToast('브리핑 생성 실패'); return null; }
      setMeetings(prev => prev.map(m =>
        m.id === meeting.id ? { ...m, ai_briefing: json.briefing } : m
      ));
      onToast('브리핑이 생성되었습니다.');
      return meeting.id;
    } catch {
      onToast('브리핑 생성에 실패했습니다.');
      return null;
    } finally {
      setGeneratingId(null);
    }
  }, [onToast]);

  const generateAll = useCallback(async () => {
    const pending = meetings.filter(m => !m.ai_briefing && m.status !== 'cancelled');
    for (const m of pending) {
      await generateBriefing(m);
    }
  }, [meetings, generateBriefing]);

  return {
    meetings, loading, generatingId,
    generateBriefing, generateAll,
  };
}
