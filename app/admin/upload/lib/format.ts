export function formatTimestamp(iso: string | null): string {
  if (!iso) return "업로드 기록 없음";
  const d = new Date(iso);
  const mm = d.getMonth() + 1;
  const dd = d.getDate();
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${mm}월 ${dd}일 ${hh}:${mi}`;
}
