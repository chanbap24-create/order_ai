import { QUICK_DELIVERY_DAYS, WEEKDAYS_KO } from "../constants";

export type QuickDeliveryDate = {
  label: string;
  value: string;
};

/**
 * 배송일 빠른 선택 버튼용 7일 목록.
 * - today → "오늘", tomorrow → "내일"
 * - value 포맷: "M/D(요일)" (메시지에 그대로 들어감)
 */
export function buildQuickDeliveryDates(
  today: Date = new Date(),
  days: number = QUICK_DELIVERY_DAYS,
): QuickDeliveryDate[] {
  const result: QuickDeliveryDate[] = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekday = WEEKDAYS_KO[date.getDay()];
    const value = `${month}/${day}(${weekday})`;
    const label = i === 0 ? "오늘" : i === 1 ? "내일" : value;
    result.push({ label, value });
  }
  return result;
}
