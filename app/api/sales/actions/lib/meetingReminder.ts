import { DAY_MS } from './constants';
import type { MeetingReminder } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MeetingRow = any;

/**
 * 향후 7일 planned 미팅 리스트 변환 (manager 필터 포함).
 */
export function detectMeetingReminders(
  meetingData: MeetingRow[] | null,
  manager: string,
  todayMs: number,
): MeetingReminder[] {
  const reminders: MeetingReminder[] = [];

  for (const m of meetingData || []) {
    const cd = m.client_details;
    const meetingManager = m.manager || '';
    const clientManager = cd?.manager || '';
    if (meetingManager && meetingManager !== manager && clientManager !== manager) continue;
    if (!meetingManager && clientManager && clientManager !== manager) continue;

    const mDate = m.meeting_date?.toString().slice(0, 10) || '';
    const daysUntil = Math.max(0, Math.floor((new Date(mDate).getTime() - todayMs) / DAY_MS));

    reminders.push({
      type: 'meeting_reminder',
      meeting_id: m.id,
      client_code: m.client_code || '',
      client_name: cd?.client_name || m.client_code || '',
      importance: cd?.importance ?? null,
      meeting_date: mDate,
      meeting_time: m.meeting_time || null,
      meeting_type: m.meeting_type || 'visit',
      purpose: m.purpose || null,
      days_until: daysUntil,
      briefing_ready: !!m.ai_briefing,
    });
  }

  return reminders;
}
