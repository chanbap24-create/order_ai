import { isHolidayKST } from "@/app/lib/holidays";

function isSundayKST(d: Date) {
  const kst = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  return kst.getDay() === 0;
}

/**
 * KST 기준 배송일 계산.
 *  - 당일 16:30 이전 → 다음 날
 *  - 16:31 이후 → 모레
 *  - 금요일 16:31 이후 → 화요일 (+4)
 *  - 일요일 / 공휴일이면 다음날로 미룸 (토요일 허용)
 */
export async function getDeliveryDateKST(now = new Date()) {
  const kstString = now.toLocaleString("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const [datePart, timePart] = kstString.split(", ");
  const [month, day, year] = datePart.split("/");
  const [hour, minute] = timePart.split(":");

  const kst = new Date(`${year}-${month}-${day}T${hour}:${minute}:00+09:00`);

  const dayOfWeek = kst.getDay();
  const hourNum = parseInt(hour);
  const minuteNum = parseInt(minute);

  let addDays = 1;
  const afterCutoff = hourNum > 16 || (hourNum === 16 && minuteNum > 30);

  if (afterCutoff) addDays = 2;
  if (dayOfWeek === 5 && afterCutoff) addDays = 4; // 금요일 16:31 이후 → 화요일

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
