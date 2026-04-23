import { useCallback, useEffect, useRef, useState } from "react";
import type { Meeting, ReminderToast } from "../types";
import { DEFAULT_REMINDER_MINUTES, MEETING_TYPES } from "../constants";
import { formatDate } from "../lib/format";

/** 첫 폴링 지연 (ms) — hydration + 첫 렌더 완료 후 백그라운드 시작 */
const WARMUP_DELAY_MS = 30000;
const POLL_INTERVAL_MS = 60000;

/**
 * 브라우저 알림 + 60초 폴링 리마인더.
 * - Notification 권한 요청은 mount 즉시가 아니라 **사용자 트리거** 시점으로 연기 (requestPermissionNow 호출)
 * - 첫 폴링은 30초 지연 후 시작 (초기 로딩 블로킹 방지)
 */
export function useReminders(meetings: Meeting[], onOpenDetail: (m: Meeting) => void) {
  const notifiedIdsRef = useRef<Set<number>>(new Set());
  const [reminderToast, setReminderToast] = useState<ReminderToast | null>(null);

  // 사용자 트리거로 권한 요청 (saveMeeting 등에서 호출)
  const requestPermissionNow = useCallback(() => {
    if (
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "default"
    ) {
      Notification.requestPermission();
    }
  }, []);

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

    // 초기 로딩 블로킹 방지: WARMUP_DELAY_MS 지연 후 첫 체크 시작
    const warmup = setTimeout(checkReminders, WARMUP_DELAY_MS);
    const interval = setInterval(checkReminders, POLL_INTERVAL_MS);
    return () => {
      clearTimeout(warmup);
      clearInterval(interval);
    };
  }, [meetings, onOpenDetail]);

  return { reminderToast, setReminderToast, requestPermissionNow };
}
