import { useEffect, useRef, useState } from "react";
import type { Meeting, ReminderToast } from "../types";
import { DEFAULT_REMINDER_MINUTES, MEETING_TYPES } from "../constants";
import { formatDate } from "../lib/format";

/**
 * 브라우저 알림 권한 + 60초 폴링 리마인더.
 */
export function useReminders(meetings: Meeting[], onOpenDetail: (m: Meeting) => void) {
  const notifiedIdsRef = useRef<Set<number>>(new Set());
  const [reminderToast, setReminderToast] = useState<ReminderToast | null>(null);

  // 권한 요청 (1회)
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "default"
    ) {
      Notification.requestPermission();
    }
  }, []);

  // 폴링
  useEffect(() => {
    const checkReminders = () => {
      const now = new Date();
      const todayStr = formatDate(now);
      const defaultMin = DEFAULT_REMINDER_MINUTES;

      for (const m of meetings) {
        if (m.meeting_date?.slice(0, 10) !== todayStr) continue;
        if (!m.meeting_time) continue;
        if (m.status === "completed" || m.status === "cancelled") continue;

        const reminderMin =
          m.reminder_minutes !== null && m.reminder_minutes !== undefined
            ? m.reminder_minutes
            : defaultMin;
        if (reminderMin === 0) continue;
        if (notifiedIdsRef.current.has(m.id)) continue;

        const [hh, mm] = m.meeting_time.split(":").map(Number);
        const meetingTime = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          hh,
          mm,
          0,
        );
        const alertTime = new Date(meetingTime.getTime() - reminderMin * 60 * 1000);

        if (now >= alertTime && now < meetingTime) {
          notifiedIdsRef.current.add(m.id);
          const mt = MEETING_TYPES[m.meeting_type] || MEETING_TYPES.visit;
          const title = `🔔 ${mt.label} · ${m.client_name}`;
          const body = `${m.meeting_time} · ${m.purpose || ""}`;

          if (
            typeof window !== "undefined" &&
            "Notification" in window &&
            Notification.permission === "granted"
          ) {
            const n = new Notification(title, { body, icon: "/favicon.ico" });
            n.onclick = () => {
              window.focus();
              onOpenDetail(m);
            };
          }

          setReminderToast({
            text: `🔔 ${m.meeting_time} ${mt.label} - ${m.client_name}`,
            meetingId: m.id,
          });
        }
      }
    };

    checkReminders();
    const interval = setInterval(checkReminders, 60000);
    return () => clearInterval(interval);
  }, [meetings, onOpenDetail]);

  return { reminderToast, setReminderToast };
}
