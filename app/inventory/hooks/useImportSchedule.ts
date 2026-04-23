import { useEffect, useState } from "react";
import { CACHE_TTL, getCached, setCached } from "@/app/lib/sessionCache";

export type ImportScheduleItem = {
  arrival_date: string;
  item_name_en: string;
  item_name_kr: string;
  brand_code: string;
  vintage: string;
  total_btls: number;
  bl_number: string;
};

type ScheduleMap = Record<string, ImportScheduleItem[]>;

const CACHE_KEY = "inventory_import_schedule";

type RawScheduleItem = Partial<ImportScheduleItem> & { item_code?: string };

function buildMap(items: RawScheduleItem[]): ScheduleMap {
  const map: ScheduleMap = {};
  for (const item of items) {
    const code = item.item_code;
    if (!code) continue;
    if (!map[code]) map[code] = [];
    map[code].push({
      arrival_date: item.arrival_date || "",
      item_name_en: item.item_name_en || "",
      item_name_kr: item.item_name_kr || "",
      brand_code: item.brand_code || "",
      vintage: item.vintage || "",
      total_btls: item.total_btls || 0,
      bl_number: item.bl_number || "",
    });
  }
  return map;
}

/**
 * 수입 일정 맵 (item_code → 스케줄 배열) + 팝업 토글 상태.
 * sessionStorage 1시간 캐시 — 재진입 시 즉시 표시 후 백그라운드 갱신.
 */
export function useImportSchedule() {
  const [importScheduleMap, setImportScheduleMap] = useState<ScheduleMap>(() => {
    return getCached<ScheduleMap>(CACHE_KEY, CACHE_TTL.IMPORT_SCHEDULE) || {};
  });
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
        const map = buildMap(data.items);
        setImportScheduleMap(map);
        setCached(CACHE_KEY, map);
      } catch {
        // ignore
      }
    })();
  }, []);

  return { importScheduleMap, showImportPopup, setShowImportPopup };
}
