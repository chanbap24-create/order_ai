import { isHolidayKST } from "@/app/lib/holidays";

/* -------------------- 배송일 계산 (공휴일 자동) -------------------- */

function isSundayKST(d: Date) {
  const kst = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  return kst.getDay() === 0; // 일요일만 불가 (토요일 OK)
}

export async function getDeliveryDateKST(now = new Date()) {
  // 정확한 KST 시간 추출
  const kstString = now.toLocaleString("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  // "01/07/2025, 16:31" → 파싱
  const parts = kstString.split(", ");
  const datePart = parts[0] || "";
  const timePart = parts[1] || "00:00";
  const dateParts = datePart.split("/");
  const month = dateParts[0] || "01";
  const day = dateParts[1] || "01";
  const year = dateParts[2] || "2025";
  const timeParts = timePart.split(":");
  const hour = timeParts[0] || "00";
  const minute = timeParts[1] || "00";

  const kst = new Date(`${year}-${month}-${day}T${hour}:${minute}:00+09:00`);

  const dayOfWeek = kst.getDay(); // 0=일, 5=금
  const hourNum = parseInt(hour);
  const minuteNum = parseInt(minute);

  let addDays = 1;
  // 4시 30분 초과 마감
  const afterCutoff = hourNum > 16 || (hourNum === 16 && minuteNum > 30);

  if (afterCutoff) addDays = 2;
  if (dayOfWeek === 5 && afterCutoff) addDays = 4; // 금요일 16:31 이후 → 화요일

  const delivery = new Date(kst);
  delivery.setDate(kst.getDate() + addDays);

  // 공휴일/일요일이면 다음날로 미룸
  while (isSundayKST(delivery) || await isHolidayKST(delivery)) {
    delivery.setDate(delivery.getDate() + 1);
  }

  const weekNames = ["일", "월", "화", "수", "목", "금", "토"];
  const w = new Date(
    delivery.toLocaleString("en-US", { timeZone: "Asia/Seoul" }),
  ).getDay();

  return {
    date: delivery,
    label: `${delivery.getMonth() + 1}/${delivery.getDate()}(${weekNames[w]})`,
  };
}
