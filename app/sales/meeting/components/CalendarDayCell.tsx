"use client";

import type { ImportScheduleItem } from "@/app/types/wine";
import type { Meeting } from "../types";
import type { CollMarker } from "../hooks/useCollectionMarkers";
import { MEETING_TYPES } from "../constants";

type Props = {
  dateStr: string;
  meetings: Meeting[];
  dayImport?: { brands: string[]; items: ImportScheduleItem[] };
  dayColl?: CollMarker[];
  holidayName?: string;
  todayStr: string;
  borderRight: boolean;
  onCreateMeeting: (date: string) => void;
  onOpenMeeting: (m: Meeting) => void;
  onOpenImport: (date: string) => void;
};

/** 월간 캘린더의 하루 셀 (미팅·수금마커·입고 표시). MonthCalendar 에서 분리. */
export function CalendarDayCell({
  dateStr, meetings, dayImport, dayColl, holidayName, todayStr, borderRight,
  onCreateMeeting, onOpenMeeting, onOpenImport,
}: Props) {
  const isToday = dateStr === todayStr;
  const isPast = dateStr < todayStr;
  const d = new Date(dateStr + "T00:00:00");
  const dayNum = d.getDate();
  const isSun = d.getDay() === 0;
  const isSat = d.getDay() === 6;
  const isHoliday = !!holidayName;

  return (
    <div
      style={{
        borderRight: borderRight ? "1px solid var(--border-subtle)" : "none",
        minHeight: 108,
        padding: 6,
        background: isToday ? "var(--surface-active)" : isHoliday ? "#fff8f8" : "var(--surface)",
        cursor: "pointer",
        overflow: "hidden",
        minWidth: 0,
        opacity: isPast && !isToday ? 0.75 : 1,
      }}
      onClick={() => onCreateMeeting(dateStr)}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: isToday ? 800 : 600,
          color: isToday ? "var(--text-on-primary)" : isSun || isHoliday ? "#c62828" : isSat ? "#1565C0" : "var(--text-primary)",
          textAlign: "center",
          marginBottom: 3,
          ...(isToday
            ? { background: "var(--action)", borderRadius: "50%", width: 22, height: 22, lineHeight: "22px", margin: "0 auto 3px" }
            : {}),
        }}
      >
        {dayNum}
      </div>
      {isHoliday && (
        <div style={{ fontSize: 9, color: "#c62828", textAlign: "center", fontWeight: 600, lineHeight: 1.1, marginBottom: 2, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
          {holidayName}
        </div>
      )}

      {meetings.slice(0, 3).map((m) => {
        const mt = MEETING_TYPES[m.meeting_type] || MEETING_TYPES.visit;
        const hasReminder = m.meeting_time && m.reminder_minutes !== 0;
        return (
          <div
            key={m.id}
            onClick={(e) => { e.stopPropagation(); onOpenMeeting(m); }}
            style={{ fontSize: 10, padding: "2px 4px", marginBottom: 2, borderRadius: 3, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", background: `${mt.color}18`, color: mt.color, fontWeight: 600, cursor: "pointer", maxWidth: "100%" }}
          >
            {hasReminder && <span style={{ fontSize: 8, marginRight: 1 }}>🔔</span>}
            {m.meeting_time?.slice(0, 5) || ""} {m.client_name}
          </div>
        );
      })}
      {meetings.length > 3 && (
        <div style={{ fontSize: 10, color: "var(--text-tertiary)", textAlign: "center", fontWeight: 600 }}>+{meetings.length - 3}건</div>
      )}

      {dayColl && dayColl.length > 0 && (
        <div style={{ marginTop: 2, display: "flex", flexDirection: "column", gap: 1 }}>
          {dayColl.slice(0, 2).map((c, i) => {
            const isPromise = c.kind === "promise";
            return (
              <div
                key={`${c.client_code}_${i}`}
                onClick={(e) => e.stopPropagation()}
                title={`수금 ${c.amount.toLocaleString()}원`}
                style={{ fontSize: 9, padding: "1px 4px", borderRadius: 3, fontWeight: 700, background: isPromise ? "#E3F2FD" : "#FDECEA", color: isPromise ? "#1565C0" : "#c62828", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}
              >
                💰{c.special ? "★" : ""} {c.client_name}
              </div>
            );
          })}
          {dayColl.length > 2 && <span style={{ fontSize: 9, color: "#c62828", fontWeight: 600 }}>+{dayColl.length - 2}</span>}
        </div>
      )}

      {dayImport && (
        <div
          onClick={(e) => { e.stopPropagation(); onOpenImport(dateStr); }}
          style={{ display: "flex", gap: 2, flexWrap: "wrap", marginTop: 2, cursor: "pointer" }}
        >
          {dayImport.brands.slice(0, 3).map((bc) => (
            <span key={bc} style={{ fontSize: 9, padding: "1px 4px", borderRadius: 3, background: "#FFF3E0", color: "#E65100", fontWeight: 700 }}>{bc}</span>
          ))}
          {dayImport.brands.length > 3 && <span style={{ fontSize: 9, color: "#E65100", fontWeight: 600 }}>+{dayImport.brands.length - 3}</span>}
        </div>
      )}
    </div>
  );
}
