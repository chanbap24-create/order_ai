import type { Meeting } from "../types";
import { MEETING_TYPES, STATUS_MAP } from "../constants";

export function buildGoogleCalendarUrl(meeting: Meeting): string {
  const mt = MEETING_TYPES[meeting.meeting_type] || MEETING_TYPES.visit;
  const title = `[${mt.label}] ${meeting.client_name}`;

  let dates: string;
  const dateOnly = meeting.meeting_date.slice(0, 10).replace(/-/g, "");
  if (meeting.meeting_time) {
    const timeStr = meeting.meeting_time.replace(/:/g, "");
    const startDT = `${dateOnly}T${timeStr}00`;
    const [hh, mm] = meeting.meeting_time.split(":").map(Number);
    const endH = hh + 1;
    const endDT = `${dateOnly}T${String(endH).padStart(2, "0")}${String(mm).padStart(2, "0")}00`;
    dates = `${startDT}/${endDT}`;
  } else {
    const d = new Date(meeting.meeting_date + "T00:00:00");
    d.setDate(d.getDate() + 1);
    const nextDate = d.toISOString().slice(0, 10).replace(/-/g, "");
    dates = `${dateOnly}/${nextDate}`;
  }

  const details = [
    meeting.purpose && `목적: ${meeting.purpose}`,
    `타입: ${mt.label}`,
    `상태: ${STATUS_MAP[meeting.status]?.label || meeting.status}`,
  ]
    .filter(Boolean)
    .join("\n");

  const params = new URLSearchParams();
  params.set("action", "TEMPLATE");
  params.set("text", title);
  params.set("dates", dates);
  params.set("details", details);
  params.set("location", meeting.client_name);

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
