/** 수입 일정 데이터: item_code → 스케줄 배열 맵 */
export async function fetchImportSchedule(): Promise<Record<string, any[]>> {
  try {
    const res = await fetch("/api/admin/upload-data/import-schedule");
    const json = await res.json();
    return json.schedule || {};
  } catch {
    return {};
  }
}
