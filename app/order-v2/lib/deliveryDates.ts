import { DELIVERY_CUTOFF, WEEKDAYS_KO } from "../constants";
import type { DeliveryDateInfo, FridayChoice, OrderTab } from "../types";

/** YYYY-MM-DD 포맷 */
const fmtDate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Date → 요일 한글 */
const dayLabel = (d: Date): string => WEEKDAYS_KO[d.getDay()];

/** 주어진 날짜가 영업일(평일+비휴일)이 될 때까지 전진 */
function nextBizDay(d: Date, holidays: Set<string>): Date {
  const result = new Date(d);
  while (true) {
    const dow = result.getDay();
    const ymd = fmtDate(result);
    if (dow !== 0 && dow !== 6 && !holidays.has(ymd)) break;
    result.setDate(result.getDate() + 1);
  }
  return result;
}

/** 현재 시각을 KST로 변환 */
function nowKST(): Date {
  const now = new Date();
  const kstOffset = 9 * 60;
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utcMs + kstOffset * 60000);
}

/**
 * 배송 예정일 계산.
 * - CDV 16:31 / DL 16:01 컷오프 기준: 이후 접수면 +2일, 전이면 +1일
 * - 금요일 접수 (컷오프 전)에는 토/월 선택 옵션 제공
 * - 토/일 기준 영업일까지 전진
 */
export function calcDeliveryDate(
  tab: OrderTab,
  holidays: Set<string>,
  fridayChoice: FridayChoice,
): DeliveryDateInfo {
  const kst = nowKST();

  const kstTime = kst.getHours() * 60 + kst.getMinutes();
  const cutoff = DELIVERY_CUTOFF[tab];
  const afterCutoff = kstTime >= cutoff;

  const baseDays = afterCutoff ? 2 : 1;
  const baseDate = new Date(kst);
  baseDate.setDate(baseDate.getDate() + baseDays);

  const dayOfWeek = kst.getDay();

  // 금요일 특수 처리
  if (dayOfWeek === 5) {
    if (afterCutoff) {
      // 금 컷오프 이후 → 화요일부터 탐색
      const tue = new Date(kst);
      tue.setDate(tue.getDate() + 4);
      const delivery = nextBizDay(tue, holidays);
      return {
        date: delivery,
        label: `${delivery.getMonth() + 1}/${delivery.getDate()}(${dayLabel(delivery)})`,
      };
    }
    // 금 컷오프 전 → 토/월 선택지
    const sat = new Date(kst);
    sat.setDate(sat.getDate() + 1);
    const mon = new Date(kst);
    mon.setDate(mon.getDate() + 3);
    const monBiz = nextBizDay(mon, holidays);

    if (fridayChoice === "saturday") {
      return { date: sat, label: `${sat.getMonth() + 1}/${sat.getDate()}(토)` };
    }
    if (fridayChoice === "monday") {
      return { date: monBiz, label: `${monBiz.getMonth() + 1}/${monBiz.getDate()}(${dayLabel(monBiz)})` };
    }
    return { date: sat, label: "", options: { sat, mon: monBiz } };
  }

  // 토/일: 다음 영업일로 전진
  const delivery = nextBizDay(baseDate, holidays);
  return {
    date: delivery,
    label: `${delivery.getMonth() + 1}/${delivery.getDate()}(${dayLabel(delivery)})`,
  };
}

/** 사용자가 직접 지정한 날짜(YYYY-MM-DD)를 "M/D(요일)" 라벨로 변환 */
export function formatCustomDeliveryLabel(ymd: string): string {
  if (!ymd) return "";
  const d = new Date(ymd + "T00:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}(${dayLabel(d)})`;
}
