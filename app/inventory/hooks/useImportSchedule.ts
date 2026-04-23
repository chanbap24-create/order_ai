import { useEffect, useState } from "react";

export type ImportScheduleItem = {
  arrival_date: string;
  item_name_en: string;
  item_name_kr: string;
  brand_code: string;
  vintage: string;
  total_btls: number;
  bl_number: string;
};

/** 수입 일정 맵 (item_code → 스케줄 배열) + 팝업 토글 상태 */
export function useImportSchedule() {
  const [importScheduleMap, setImportScheduleMap] = useState<
    Record<string, ImportScheduleItem[]>
  >({});
  const [showImportPopup, setShowImportPopup] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const res = await fetch(
          `/api/admin/upload-data/import-schedule?start_date=${today}`,
        );
        const data = await res.json();
        if (!data.success || !data.items) return;
        const map: Record<string, ImportScheduleItem[]> = {};
        for (const item of data.items) {
          const code = item.item_code;
          if (!map[code]) map[code] = [];
          map[code].push({
            arrival_date: item.arrival_date,
            item_name_en: item.item_name_en,
            item_name_kr: item.item_name_kr || "",
            brand_code: item.brand_code || "",
            vintage: item.vintage || "",
            total_btls: item.total_btls,
            bl_number: item.bl_number,
          });
        }
        setImportScheduleMap(map);
      } catch {
        // ignore
      }
    })();
  }, []);

  return { importScheduleMap, showImportPopup, setShowImportPopup };
}
