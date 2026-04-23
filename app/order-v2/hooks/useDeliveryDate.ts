import { useEffect, useMemo, useState } from "react";
import { fetchHolidays } from "../lib/api";
import { calcDeliveryDate, formatCustomDeliveryLabel } from "../lib/deliveryDates";
import type { FridayChoice, OrderTab } from "../types";

/**
 * 배송일 상태:
 * - 현재 연도 휴일 Set (mount 시 1회 fetch)
 * - 금요일 접수 시 토/월 선택지
 * - 사용자가 직접 지정한 날짜 (YYYY-MM-DD)
 * - 최종 표시용 라벨 (customDeliveryDate 우선)
 */
export function useDeliveryDate(tab: OrderTab) {
  const [holidays, setHolidays] = useState<Set<string>>(new Set());
  const [fridayChoice, setFridayChoice] = useState<FridayChoice>();
  const [customDate, setCustomDate] = useState(""); // YYYY-MM-DD

  useEffect(() => {
    const year = new Date().getFullYear();
    void fetchHolidays(year).then(setHolidays);
  }, []);

  const info = useMemo(
    () => calcDeliveryDate(tab, holidays, fridayChoice),
    [tab, holidays, fridayChoice],
  );

  const finalLabel = customDate ? formatCustomDeliveryLabel(customDate) : info.label;

  const reset = () => {
    setCustomDate("");
    setFridayChoice(undefined);
  };

  return {
    holidays,
    info,
    fridayChoice,
    setFridayChoice,
    customDate,
    setCustomDate,
    finalLabel,
    reset,
  };
}
