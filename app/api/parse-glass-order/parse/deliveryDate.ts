import { isHolidayKST } from "@/app/lib/holidays";

function isSundayKST(d: Date) {
  const kst = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  return kst.getDay() === 0;
}

/**
 * KST 배송일 계산. 16:31 이후 모레 / 금요일 16:31 이후 화요일.
 * 일요일/공휴일이면 다음날로 미룸 (토요일 허용).
 */
export async function getDeliveryDateKST(now = new Date()) {
  const kst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));

  const day = kst.getDay();
  const hour = kst.getHours();
  const minute = kst.getMinutes();

  let addDays = 1;
  const afterCutoff = hour > 16 || (hour === 16 && minute >= 31);

  if (afterCutoff) addDays = 2;
  if (day === 5 && afterCutoff) addDays = 4;

  const delivery = new Date(kst);
  delivery.setDate(kst.getDate() + addDays);

  while (isSundayKST(delivery) || await isHolidayKST(delivery)) {
    delivery.setDate(delivery.getDate() + 1);
  }

  const weekNames = ["일", "월", "화", "수", "목", "금", "토"];
  const w = new Date(delivery.toLocaleString("en-US", { timeZone: "Asia/Seoul" })).getDay();

  return {
    date: delivery,
    label: `${delivery.getMonth() + 1}/${delivery.getDate()}(${weekNames[w]})`,
  };
}
