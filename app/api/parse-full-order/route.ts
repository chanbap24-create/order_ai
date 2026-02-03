import { NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { parseItemsFromMessage } from "@/app/lib/parseItems";
import { resolveItemsByClient } from "@/app/lib/resolveItems";
import { resolveItemsByClientWeighted } from "@/app/lib/resolveItemsWeighted";
import { searchNewItem } from "@/app/lib/newItemResolver";
import { syncFromXlsxIfNeeded } from "@/app/lib/syncFromXlsx";
import { translateOrderToKoreanIfNeeded } from "@/app/lib/translateOrder";
import { jsonResponse } from "@/app/lib/api-response";
import type { ParseFullOrderResponse } from "@/app/types/api";
import { hierarchicalSearch } from "@/app/lib/brandMatcher";


import Holidays from "date-holidays";

export const runtime = "nodejs";

// GET 메소드 추가 (API 상태 확인용)
export async function GET() {
  return jsonResponse({
    success: true,
    message: "parse-full-order API is running. Use POST method to parse orders.",
    version: "2.0.0",
    features: {
      suggestions: 8,
      sorting: "existing_items_first",
      lastUpdated: "2026-02-02T04:45:00Z"
    }
  });
}

function cleanClientCode(code: any) {
  return String(code || "").replace(/\.0$/, "");
}

/* -------------------- preprocess -------------------- */
// ✅ 글자/숫자 붙어쓴 케이스 분리 + 문장형 주문 정리
function preprocessMessage(text: string) {
  let s = String(text || "");

  // 통일
  s = s.replace(/\r/g, "\n");

  // 인사말/군더더기 제거 (앞/중간에 섞여도 최대한 제거)
  s = s.replace(/안녕하세요\.?|안녕하십니까\.?/g, " ");
  s = s.replace(
    /(부탁드려요|부탁드립니다|부탁해요|주세요|주문합니다|주문드려요|주문드립니다)\.?/g,
    " "
  );
  s = s.replace(/(감사합니다|고맙습니다|고맙습니다요|감사해요)\.?/g, " ");
  s = s.replace(/(입니다|요)\.?/g, " ");

  // ✅ 슬래시/구분자: 한 줄 여러 품목을 줄로 쪼개기
  s = s.replace(/\s*\/\s*/g, "\n");
  // ✅ 쉼표 처리: 영문명이 포함된 경우 쉼표를 유지
  // 예: "Christophe Pitois, Grand Cru" → 쉼표 유지
  // 예: "샤또마르고, 루이로드레" → 쉼표를 줄바꿈으로 변경
  const lines = s.split('\n');
  s = lines.map(line => {
    // 영문명이 포함된 경우 쉼표를 유지 (3글자 이상 영어 단어 2개 이상 + 쉼표)
    const hasEnglishWords = (line.match(/[A-Za-z]{3,}/g) || []).length >= 2;
    const hasComma = line.includes(',');
    
    if (hasEnglishWords && hasComma) {
      return line; // 영문명이 있으면 쉼표 유지
    } else {
      return line.replace(/\s*,\s*/g, "\n"); // 쉼표를 줄바꿈으로
    }
  }).join('\n');

  // ✅ 주문 가능 문구/요청문 제거 (숫자 뒤에 붙어서 수량 인식 방해)
  s = s.replace(
    /(발주\s*가능할까요|가능할까요|가능한가요|발주\s*가능)\??/g,
    " "
  );

  // 문장부호 -> 줄바꿈(문장형 주문을 라인형으로)
  s = s.replace(/[.!?]/g, "\n");

  // ✅ 핵심: "샤도3", "부르고뉴샤도6" 같은 케이스 처리
  // (한글/영문) + 숫자 (단, 프랑스어 서수 "1er", "2eme" 등은 제외)
  s = s.replace(/([가-힣A-Za-z])(\d+)(?!(er|eme|ième)\b)/gi, "$1 $2");
  // 숫자 + (한글/영문) (단, 프랑스어 서수 제외)
  s = s.replace(/(\d+)(?<!(1|2|3))([가-힣A-Za-z])/g, "$1 $2");
  
  // ✅ 한글-영문 사이 공백 추가 (알테시노bdm → 알테시노 bdm)
  s = s.replace(/([가-힣])([a-z])/gi, "$1 $2");
  s = s.replace(/([a-z])([가-힣])/gi, "$1 $2");

  // ✅ 남는 꼬리 표현 제거 (발주가능할까요 → 할까 같은 잔여 처리)
  s = s.replace(/(할까요|할까|될까요|될까|가능할까요|가능할까)\b/g, " ");

  // ✅ 라인별로 "숫자(수량) 뒤"에 붙은 텍스트를 잘라내기
  // 예: "위게뜨블랑 2 할까" -> "위게뜨블랑 2"
  // 단, "2병/2박스/cs" 같은 단위는 유지
  s = s
    .split("\n")
    .map((line) => {
      const l = line.trim();
      if (!l) return l;

      // ✅ "THE NEST ... 2023 2" 같은 케이스에서 2023이 아니라 "2"를 수량으로 잡아야 함
      // - 줄 끝의 "마지막 숫자"를 수량으로 인식하도록 (.*) 를 greedy로
      // - 단위가 있으면 같이 잡음 (bt/btl 포함)
      const m = l.match(/^(.*)\b(\d{1,4})\s*(병|박스|cs|box|bt|btl)?\s*$/i);

      if (!m) return l;

      const name = (m[1] || "").trim();
      const qty = (m[2] || "").trim();
      const unit = (m[3] || "").trim();

      return [name, qty, unit].filter(Boolean).join(" ").trim();
    })
    .join("\n");


  // 공백 정리
  s = s
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");

  return s.trim();
}

/* -------------------- utils -------------------- */
function norm(s: any) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[()\-_/.,]/g, "")
    .replace(/(주식회사|\(주\)|주\.)/g, "");
}
function extractKoreanTokens(s: string) {
  return (String(s || "").match(/[가-힣A-Za-z0-9]{2,}/g) || [])
    .map((t) => t.trim())
    .filter(Boolean);
}

// 입력에서 "브랜드(핵심)" 토큰 1개를 뽑음: 가장 긴 토큰 우선
function pickBrandToken(input: string) {
  const stop = new Set(["주식회사", "스시", "점", "지점", "본점"]); // 필요하면 추가
  
  // ✅ 괄호 안의 별칭도 추출 (예: "라뜨리에드 오르조" from "에프엔비버드독 (라뜨리에드 오르조)")
  const aliasMatch = input.match(/\(([^)]+)\)/);
  const mainText = input.replace(/\([^)]+\)/g, "").trim();
  const aliasText = aliasMatch ? aliasMatch[1].trim() : "";
  
  // 메인 텍스트와 괄호 안 텍스트 모두에서 토큰 추출
  const allText = [mainText, aliasText].filter(Boolean).join(" ");
  
  const toks = extractKoreanTokens(allText)
    .map((t) => t.replace(/(지점|점|본점)$/g, ""))
    .filter((t) => t.length >= 2 && !stop.has(t));

  // 가장 긴 걸 브랜드 토큰으로 (스시소라 같은 게 보통 제일 김)
  toks.sort((a, b) => b.length - a.length);
  return toks[0] || "";
}


function firstLine(text: any) {
  const lines = String(text || "")
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  return lines[0] || "";
}

function scoreName(q: any, name: any) {
  const qRaw = String(q ?? "");
  const nRaw = String(name ?? "");

  const a = norm(qRaw);
  if (!a) return 0;

  // ✅ (0) 괄호 안 상호명 우선 매칭 - 최우선 처리!
  const nameAlias = nRaw.match(/\(([^)]+)\)/);
  const nameMainText = nRaw.replace(/\([^)]+\)/g, "").trim();
  
  // 괄호 안 별칭이 있으면 별칭과 메인 이름 모두 비교
  if (nameAlias) {
    const aliasText = nameAlias[1].trim();
    const aliasNorm = norm(aliasText);
    const mainNorm = norm(nameMainText);
    
    // 별칭과 완전 일치
    if (a === aliasNorm) return 1.0;
    
    // 메인 이름과 완전 일치
    if (a === mainNorm) return 1.0;
    
    // 별칭 포함 관계 (우선순위 높음)
    if (aliasNorm.includes(a)) return 0.98;
    if (a.includes(aliasNorm) && aliasNorm.length >= 3) return 0.97;
    
    // 메인 이름 포함 관계
    if (mainNorm.includes(a)) return 0.96;
    if (a.includes(mainNorm) && mainNorm.length >= 3) return 0.95;
    
    // 별칭 유사도 매칭
    const aChars = new Set(a.split(""));
    const aliasChars = new Set(aliasNorm.split(""));
    let commonAlias = 0;
    for (const ch of aChars) {
      if (aliasChars.has(ch)) commonAlias++;
    }
    const aliasSimilarity = commonAlias / Math.max(a.length, aliasNorm.length);
    
    // 70% 이상 유사하면 괄호 안 상호명으로 간주
    if (aliasSimilarity >= 0.7) {
      const lenDiff = Math.abs(a.length - aliasNorm.length);
      const lenPenalty = lenDiff * 0.02;
      return Math.max(0.85, Math.min(0.94, 0.92 - lenPenalty));
    }
    
    // 메인 이름 유사도 매칭
    const mainChars = new Set(mainNorm.split(""));
    let commonMain = 0;
    for (const ch of aChars) {
      if (mainChars.has(ch)) commonMain++;
    }
    const mainSimilarity = commonMain / Math.max(a.length, mainNorm.length);
    
    if (mainSimilarity >= 0.7) {
      const lenDiff = Math.abs(a.length - mainNorm.length);
      const lenPenalty = lenDiff * 0.02;
      return Math.max(0.80, Math.min(0.90, 0.88 - lenPenalty));
    }
  }
  
  // 괄호가 없는 경우
  const b = norm(nRaw);
  if (!b) return 0;
  
  // 완전 일치
  if (a === b) return 1.0;
  
  // 포함 관계
  if (b.includes(a)) return 0.90;
  if (a.includes(b) && b.length >= 3) return 0.88;
  
  // 문자 겹침 비율
  const aset = new Set(a.split(""));
  let common = 0;
  for (const ch of aset) if (b.includes(ch)) common++;
  const overlap = common / Math.max(a.length, b.length);
  
  // 유사도 점수
  if (overlap >= 0.7) {
    const lenDiff = Math.abs(a.length - b.length);
    const lenPenalty = lenDiff * 0.02;
    return Math.max(0.60, Math.min(0.85, 0.82 - lenPenalty));
  }
  
  return Math.max(0, Math.min(0.75, overlap * 0.9));
}



/* -------------------- 배송일 계산 (공휴일 자동) -------------------- */
// ✅ 한국 공휴일: date-holidays 사용 (설/추석/대체공휴일 포함)
const hd = new Holidays("KR");

function toKSTParts(d: Date) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return { y, m, day };
}

function kstDateForHolidayCheck(d: Date) {
  // KST의 날짜로 고정된 Date를 만들어 체크 (서버 로컬 타임존 영향 최소화)
  const { y, m, day } = toKSTParts(d);
  return new Date(`${y}-${m}-${day}T12:00:00+09:00`); // 정오로 안전하게
}

function isSundayKST(d: Date) {
  const kst = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  return kst.getDay() === 0; // 일요일만 불가 (토요일 OK)
}

function isHolidayKST(d: Date) {
  const chk = kstDateForHolidayCheck(d);
  return Boolean(hd.isHoliday(chk));
}

function getDeliveryDateKST(now = new Date()) {
  // ✅ 정확한 KST 시간 추출
  const kstString = now.toLocaleString("en-US", { 
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  
  // "01/07/2025, 16:31" → 파싱
  const [datePart, timePart] = kstString.split(", ");
  const [month, day, year] = datePart.split("/");
  const [hour, minute] = timePart.split(":");
  
  const kst = new Date(`${year}-${month}-${day}T${hour}:${minute}:00+09:00`);
  
  const dayOfWeek = kst.getDay(); // 0=일, 5=금
  const hourNum = parseInt(hour);
  const minuteNum = parseInt(minute);

  let addDays = 1;
  // ✅ 4시 30분 초과를 마감으로 (4시 30분까지는 당일 마감)
  const afterCutoff = hourNum > 16 || (hourNum === 16 && minuteNum > 30);

  if (afterCutoff) addDays = 2;
  if (dayOfWeek === 5 && afterCutoff) addDays = 4; // 금요일 16:31 이후 → 화요일

  const delivery = new Date(kst);
  delivery.setDate(kst.getDate() + addDays);

  // ✅ 공휴일/일요일이면 다음날로 미룸 (토요일은 허용)
  while (isSundayKST(delivery) || isHolidayKST(delivery)) {
    delivery.setDate(delivery.getDate() + 1);
  }

  const weekNames = ["일", "월", "화", "수", "목", "금", "토"];
  const w = new Date(
    delivery.toLocaleString("en-US", { timeZone: "Asia/Seoul" })
  ).getDay();

  return {
    date: delivery,
    label: `${delivery.getMonth() + 1}/${delivery.getDate()}(${weekNames[w]})`,
  };
}

/* -------------------- client resolve (client_alias) -------------------- */
function resolveClient({
  clientText,
  message,
  forceResolve,
}: {
  clientText: string;
  message: string;
  forceResolve: boolean;
}) {
  const candidate = String(clientText || "").trim() || firstLine(message);

  // ✅ 1) 거래처 코드 직접 입력 (숫자 5자리)
  if (candidate && /^\d{5}$/.test(candidate)) {
    const directClient = db
      .prepare(`SELECT client_code, client_name FROM clients WHERE client_code = ?`)
      .get(candidate) as any;
    
    if (directClient) {
      return {
        status: "resolved",
        client_code: String(directClient.client_code),
        client_name: String(directClient.client_name),
        method: "exact_code",
      };
    }
  }

  const rows = db
    .prepare(`SELECT client_code, alias, weight FROM client_alias`)
    .all() as Array<{ client_code: any; alias: any; weight?: any }>;

  // ✅ 2) exact(norm) 매칭
  if (candidate) {
    const exact = rows.find(
      (r) => norm(r.alias) && norm(r.alias) === norm(candidate)
    );
    if (exact) {
      return {
        status: "resolved",
        client_code: String(exact.client_code),
        client_name: String(exact.alias),
        method: "exact_norm_firstline",
      };
    }
  }


// fuzzy
const q = candidate || message || "";
const scored = rows
  .map((r) => {
    const base = scoreName(q, r.alias);
    const w = Number((r as any).weight ?? 1);

    // ✅ weight 보너스
    let bonus = Math.min(0.2, Math.max(0, (w - 1) * 0.02));

    // ✅ base가 낮으면(weight로 역전 방지)
    if (base <= 0.5) bonus = 0;

    // ✅ 최종 점수
    const s = Math.min(1.0, base + bonus);

    return {
      client_name: String(r.alias),
      client_code: String(r.client_code),
      score: Number(s.toFixed(3)),
    };
  })
  .sort((a, b) => b.score - a.score)
  .slice(0, 8);





  const top = scored[0];
  const second = scored[1];




  const canAuto =
    top && top.score >= 0.90 && (!second || top.score - second.score >= 0.08);
  if (canAuto) return { status: "resolved", ...top, method: "fuzzy_auto" };

  const forceOk =
    Boolean(forceResolve) &&
    top &&
    top.score >= 0.45 &&
    (!second || top.score - second.score >= 0.15);

  if (forceOk) return { status: "resolved", ...top, method: "fuzzy_force" };

  return {
    status: "needs_review_client",
    score: top?.score ?? 0,
    candidates: scored,
    hint_used: candidate,
  };
}

/* -------------------- main -------------------- */
function isLikelyOrderLine(line: string) {
  // 숫자/병/박스 같은 게 있으면 주문일 가능성이 큼
  return /(\d|병|박스|cs|box|bt|btl)/i.test(line);
}

function splitClientAndOrder(body: any) {
  const message = body?.message ?? "";
  const clientText = body?.clientText ?? "";
  const orderText = body?.orderText ?? "";

  if (clientText || orderText) {
    return {
      rawMessage: String(message || ""),
      clientText: String(clientText || ""),
      orderText: String(orderText || ""),
    };
  }

  const msg = String(message || "").replace(/\r/g, "");
  const lines = msg.split("\n");
  const first = (lines[0] || "").trim();
  const rest = lines.slice(1).join("\n").trim();

  // ✅ 한 줄뿐이면: “거래처”로 가정하지 말고 주문으로 취급
  if (lines.length <= 1) {
    return { rawMessage: msg, clientText: "", orderText: msg };
  }

  // ✅ 첫 줄이 주문처럼 보이면(숫자/병 등 포함) 거래처 비움
  if (isLikelyOrderLine(first)) {
    return { rawMessage: msg, clientText: "", orderText: msg };
  }

  // 기존: 첫 줄 거래처 + 나머지 주문
  return { rawMessage: msg, clientText: first, orderText: rest };
}

/**
 * 품목 코드에서 빈티지 추출
 * 코드 3,4번째 자리가 빈티지 (예: 3021701 → 21 → 2021)
 */
function extractVintage(itemNo: string): number | null {
  const code = String(itemNo || '');
  if (code.length < 4) return null;
  
  const vintageStr = code.substring(2, 4); // 3,4번째 (index 2,3)
  const vintage = parseInt(vintageStr, 10);
  
  if (isNaN(vintage)) return null;
  
  // 21 → 2021, 18 → 2018
  return vintage < 50 ? 2000 + vintage : 1900 + vintage;
}

/**
 * 품목명에서 빈티지 제거 (비교용)
 * 예: "샤블리 (2021)" → "샤블리"
 */
function removeVintageFromName(name: string): string {
  return String(name || '')
    .replace(/^[A-Z]{2}\s+/, '') // 앞의 접두어 제거 (AR, VG, MR 등)
    .replace(/\s*\(\d{4}\)\s*/g, '') // (2021) 제거
    .replace(/\s*\d{4}\s*$/, '') // 끝의 2021 제거
    .replace(/,\s*/g, ' ') // 쉼표도 제거
    .trim();
}

function formatStaffMessage(
  client: any,
  items: any[],
  options?: {
    customDeliveryDate?: string;
    requirePaymentConfirm?: boolean;
    requireInvoice?: boolean;
  }
) {
  const delivery = getDeliveryDateKST();
  const deliveryLabel = options?.customDeliveryDate || delivery.label;

  const lines: string[] = [];
  
  // ✅ 거래처 정보 안전하게 처리
  const clientName = String(client?.client_name || "미정").trim();
  const clientCode = client?.client_code ? cleanClientCode(client.client_code) : "미정";
  lines.push(`거래처: ${clientName} (${clientCode})`);
  lines.push(`배송 예정일: ${deliveryLabel}`);
  
  // ✅ 신규 사업자 정보 (연락처, 이메일)
  if ((client as any).phone) {
    lines.push(`연락처: ${(client as any).phone}`);
  }
  if ((client as any).email) {
    lines.push(`세금계산서: ${(client as any).email}`);
  }
  
  lines.push(""); // 한 칸 띄우기
  
  // ✅ 발주 옵션 (배송일 두 칸 아래에 표기)
  if (options?.requirePaymentConfirm) {
    lines.push("입금확인후 출고");
  }
  if (options?.requireInvoice) {
    lines.push("거래명세표 부탁드립니다");
  }
  
  lines.push("");
  lines.push("품목:");

  for (const it of items) {
    // ✅ undefined/null 품목명 스킵
    const itemName = String(it.name || it.item_name || "").trim().toLowerCase();
    if (!itemName || itemName === "undefined" || itemName === "null" || it.name === undefined || it.name === null) {
      console.log('[formatStaffMessage] 무효 품목 스킵:', JSON.stringify({name: it.name, item_name: it.item_name, raw: it.raw}));
      continue;
    }
    
    if (it.resolved) {
      // ✅ resolved인데 item_no가 없으면 스킵 (방어 로직)
      if (!it.item_no) {
        console.log('[formatStaffMessage] resolved이지만 item_no 없음, 스킵:', JSON.stringify({name: it.name, raw: it.raw}));
        continue;
      }
      
      // ✅ 한글 이름만 추출 (영어 및 약어 제거)
      let koreanName = String(it.item_name || '');
      
      // 1. " / " 앞부분만 (한글 부분)
      if (koreanName.includes(' / ')) {
        koreanName = koreanName.split(' / ')[0].trim();
      }
      
      // 2. 괄호 안 영어 제거 (예: "샤블리 (Chablis)" → "샤블리")
      koreanName = koreanName.replace(/\s*\([^)]*\)\s*/g, '').trim();
      
      // 3. 앞의 영문 약어 제거 (예: "AT 알테시노" → "알테시노", "CH 샤또" → "샤또")
      koreanName = koreanName.replace(/^[A-Z]{1,3}\s+/, '');
      
      // 가격 정보가 있으면 포함
      const priceInfo = it.unit_price_hint 
        ? ` / ${it.unit_price_hint.toLocaleString()}원`
        : '';
      lines.push(`- ${it.item_no} / ${koreanName} / ${it.qty}병${priceInfo}`);
    } else {
      // 미확정 품목도 가격 정보가 있으면 포함
      const priceInfo = it.unit_price_hint 
        ? ` / ${it.unit_price_hint.toLocaleString()}원`
        : '';
      const displayName = it.name !== undefined && it.name !== null ? String(it.name) : "이름없음";
      lines.push(`- 확인필요 / "${displayName}" / ${it.qty}병${priceInfo}`);
    }
  }

  lines.push("");
  lines.push("발주 요청드립니다.");
  return lines.join("\n");
}

export async function POST(req: Request): Promise<NextResponse<ParseFullOrderResponse>> {
  // ✅ 엑셀 자동 동기화 (파일 변경 시에만 실행)
  const sync = syncFromXlsxIfNeeded();
  console.log("[XLSX SYNC]", sync);

  try {
    const body = await req.json().catch(() => ({}));
    const forceResolve = Boolean(body?.force_resolve);
    const pageType = body?.type || "wine"; // 기본값 wine
    
    // ✅ 신규 사업자 처리
    const newBusiness = body?.newBusiness;
    if (newBusiness && newBusiness.name && newBusiness.phone) {
      console.log("[NEW BUSINESS]", newBusiness);
      
      // 품목만 파싱
      const pre0 = preprocessMessage(body?.message ?? "");
      const trMsg = await translateOrderToKoreanIfNeeded(pre0);
      const preMessage = trMsg.translated ? trMsg.text : pre0;
      const parsedItems = parseItemsFromMessage(preMessage)
        // ✅ "undefined" 필터링
        .filter(item => {
          const name = String(item.name || "").trim().toLowerCase();
          if (name === "undefined" || name === "null" || name === "") {
            console.log(`[FILTER] 무효 입력 제거: "${item.raw}"`);
            return false;
          }
          return true;
        });
      
      // 거래처 정보는 신규 사업자로 설정 (client_code는 임시로 "NEW")
      const client = {
        status: "resolved" as const,
        client_name: newBusiness.name,
        client_code: "NEW",
        phone: newBusiness.phone,
        email: newBusiness.email, // 이메일 추가
      };
      
      // 신규 사업자는 이력 없음 → master_items에서만 검색
      console.log("[NEW BUSINESS] Calling resolveItemsByClientWeighted with parsedItems:", parsedItems);
      
      const resolvedItems = resolveItemsByClientWeighted("NEW", parsedItems, {
        minScore: 0.55,
        minGap: 0.05,
        topN: 10, // ✅ 10개로 증가 (루이 미셸 등 다양한 브랜드 포함)
      });
      
      console.log("[NEW BUSINESS] resolvedItems:", JSON.stringify(resolvedItems, null, 2));
      
      // suggestions 추가 (안전하게 score 처리)
      const itemsWithSuggestions = resolvedItems.map((it: any) => {
        if (!it.resolved && it.candidates?.length > 0) {
          // ✅ candidates를 suggestions로 변환 (10개로 증가, supply_price 포함)
          const suggestions = it.candidates.slice(0, 10).map((c: any) => ({
            ...c,
            score: c.score ?? 0,
            supply_price: c.supply_price, // ✅ 공급가 포함
          }));
          
          return {
            ...it,
            suggestions,
          };
        }
        return {
          ...it,
          suggestions: []
        };
      });
      
      console.log("[NEW BUSINESS] itemsWithSuggestions:", JSON.stringify(itemsWithSuggestions, null, 2));

      // ✅ 같은 item_no를 가진 아이템 통합 (수량 합산)
      const mergedItems = (() => {
        const itemMap = new Map<string, any>();
        for (const item of itemsWithSuggestions) {
          if (item.resolved && item.item_no) {
            const key = String(item.item_no);
            const existing = itemMap.get(key);
            if (existing) {
              // 같은 품목이 여러 번 확정된 경우 수량 합산
              existing.quantity = (existing.quantity || 0) + (item.quantity || 0);
            } else {
              itemMap.set(key, { ...item });
            }
          } else {
            // 미확정 아이템은 그대로 추가 (중복 체크 안 함)
            itemMap.set(`unresolved_${Date.now()}_${Math.random()}`, { ...item });
          }
        }
        return Array.from(itemMap.values());
      })();

      console.log("[NEW BUSINESS] mergedItems:", JSON.stringify(mergedItems, null, 2));
      
      const allResolved = mergedItems.every((it: any) => it.resolved);
      
      // 직원 메시지 생성
      console.log("[NEW BUSINESS] Calling formatStaffMessage...");
      const staffMessage = formatStaffMessage(
        client,
        mergedItems,
        {
          customDeliveryDate: body?.customDeliveryDate,
          requirePaymentConfirm: body?.requirePaymentConfirm,
          requireInvoice: body?.requireInvoice,
        }
      );
      
      console.log("[NEW BUSINESS] staffMessage generated:", staffMessage);
      
      return jsonResponse({
        success: true,
        status: allResolved ? "resolved" : "needs_review_items",
        client,
        parsed_items: mergedItems,
        items: mergedItems, // ✅ 프론트엔드 호환성
        staff_message: staffMessage,
        is_new_business: true,
      } as any);
    }

    // ✅ 0) 전체 메시지 전처리 먼저
    const pre0 = preprocessMessage(body?.message ?? "");

    // ✅ 0-1) 번역(영어 비중 높을 때만). 기존 데이터/로직 영향 없음.
    const trMsg = await translateOrderToKoreanIfNeeded(pre0);
    const preMessage = trMsg.translated ? trMsg.text : pre0;

    // ✅ 전처리된 message로 split 수행
    const { rawMessage, clientText, orderText } = splitClientAndOrder({
      ...body,
      message: preMessage,
    });

    // 1) 거래처 resolve
    const client = resolveClient({
      clientText,
      message: rawMessage,
      forceResolve,
    });

    if (client.status !== "resolved") {
      return jsonResponse({
        success: true,
        status: "needs_review_client",
        client,
        debug: {
          preprocessed_message: preMessage,
          translation_message: trMsg.translated ? "translated" : "no",
          clientText,
          orderText,
        },
      } as any);
    }

    // 2) 품목 파싱 (orderText도 한번 더 전처리)
    const order0 = preprocessMessage(orderText || rawMessage);

    // ✅ 2-1) 번역(영어 비중 높을 때만)
    const trOrder = await translateOrderToKoreanIfNeeded(order0);
    const orderPre = trOrder.translated ? trOrder.text : order0;

    const parsedItems = parseItemsFromMessage(orderPre)
      // ✅ "undefined" 필터링: 프론트에서 빈 입력을 "undefined"로 보낼 때 제거
      .filter(item => {
        const name = String(item.name || "").trim().toLowerCase();
        console.log(`[FILTER-CHECK] raw="${item.raw}", name="${name}"`);
        if (name === "undefined" || name === "null" || name === "") {
          console.log(`[FILTER] 무효 입력 제거: "${item.raw}"`);
          return false;
        }
        return true;
      });

    const clientCode = client?.client_code;
    if (!clientCode) {
      return jsonResponse({
        success: true,
        status: "needs_review_client",
        client,
        error: "client_code가 없어 품목 resolve를 진행할 수 없습니다.",
      } as any);
    }

    // ✅ 3-0) 브랜드 우선 매칭 시도 (새로운 2단계 계층적 검색)
    // Wine 페이지에서만 활성화
    let brandMatchedItems: any[] = [];
    if (pageType === "wine") {
      console.log("[BrandMatch] 브랜드 우선 매칭 시작");
      for (let i = 0; i < parsedItems.length; i++) {
        const item = parsedItems[i];
        const inputName = item.name || '';
        if (!inputName) continue;

        try {
          const brandResults = hierarchicalSearch(inputName, 0.5, 0.5, 2);
          
          if (brandResults.length > 0 && brandResults[0].wines.length > 0) {
            const topBrand = brandResults[0];
            const topWine = topBrand.wines[0];
            
            console.log(`[BrandMatch] ✅ "${inputName}" → ${topBrand.brand.supplier_kr} / ${topWine.wine_kr} (score: ${topWine.score.toFixed(3)})`);
            
            // 브랜드 매칭된 아이템 저장 (원본 순서 인덱스 포함)
            brandMatchedItems.push({
              _originalIndex: i,
              raw: item.raw,
              name: item.name,
              qty: item.qty,
              normalized_query: inputName,
              // ✅ item_no가 유효하고 점수가 0.7 이상일 때만 자동 확정
              resolved: !!(topWine.item_no) && topWine.score >= 0.7,
              item_no: topWine.item_no,
              item_name: topWine.wine_kr,
              score: topWine.score,
              method: 'brand_hierarchical',
              brand_info: {
                brand_name: topBrand.brand.supplier_kr,
                brand_score: topBrand.brand.score,
              },
              candidates: topBrand.wines.slice(0, 5).map((w: any) => ({
                item_no: w.item_no,
                item_name: w.wine_kr,
                score: w.score,
                method: 'brand_hierarchical',
              })),
            });
            
            continue; // 브랜드 매칭 성공하면 기존 로직 스킵
          }
        } catch (err) {
          console.error(`[BrandMatch] 오류: ${err}`);
        }
      }
    }

    // 3) 품목 resolve
    // 🎯 조합 가중치 시스템으로 품목 매칭!
    // 브랜드 매칭되지 않은 품목만 기존 방식으로 처리
    const itemsToResolve = brandMatchedItems.length > 0
      ? parsedItems.map((item: any, idx: number) => ({ ...item, _originalIndex: idx }))
          .filter((item: any) => 
            !brandMatchedItems.some((bm: any) => bm.name === item.name)
          )
      : parsedItems.map((item: any, idx: number) => ({ ...item, _originalIndex: idx }));

    console.log(`[품목 resolve] 전체: ${parsedItems.length}개, 브랜드 매칭: ${brandMatchedItems.length}개, 기존 방식: ${itemsToResolve.length}개`);

    const resolvedItems = itemsToResolve.length > 0
      ? resolveItemsByClientWeighted(clientCode, itemsToResolve, {
          minScore: 0.55,
          minGap: 0.05,
          topN: 5,
        })
      : [];

    // 브랜드 매칭 결과와 기존 방식 결과 병합 후 원본 순서로 정렬
    const allResolvedItems = [...brandMatchedItems, ...resolvedItems]
      .sort((a: any, b: any) => (a._originalIndex ?? 0) - (b._originalIndex ?? 0));

    // ✅ 3-1) unresolved인 품목에 후보 3개(suggestions) 붙이기 (UI용)
    //     - 새로 DB에서 찾지 말고, resolveItemsByClient가 만든 candidates를 그대로 사용
    //     - 🆕 신규 품목: 기존 매칭이 약하면 English 시트에서 검색
    const itemsWithSuggestions = allResolvedItems.map((x: any) => {
      // ✅ resolved인데 item_no가 없으면 false로 변경 (최우선 검사)
      if (x?.resolved && !x?.item_no) {
        console.log(`[CRITICAL] ${x.name}: resolved=true인데 item_no 없음 → resolved=false로 강제 변경`);
        x = { ...x, resolved: false };
      }
      
      // ✅ 이미 resolved된 경우 그대로 반환
      if (x?.resolved) return x;
      
      // ✅ 중앙 설정 가져오기
      const { ITEM_MATCH_CONFIG, decideSuggestionComposition } = require('@/app/lib/itemMatchConfig');
      const config = ITEM_MATCH_CONFIG;
      
      // candidates가 있으면 정렬 (아직 개수 제한 안 함)
      const candidates = Array.isArray(x?.candidates) ? x.candidates : [];
      
      // ⚠️ 빈티지 중복 제거 제거! → 모든 후보를 유지하고, 나중에 suggestions에서 처리
      // 이유: 기존 입고 품목과 신규 빈티지를 모두 표시해야 함
      const dedupedCandidates = candidates.slice(); // 모든 후보 유지
      
      const sortedCandidates = dedupedCandidates
        .slice()
        .sort((a: any, b: any) => {
          // 1순위: 점수 내림차순
          const scoreDiff = (b?.score ?? 0) - (a?.score ?? 0);
          if (Math.abs(scoreDiff) > 0.0001) return scoreDiff;
          
          // 2순위: 동점일 때 item_no 오름차순 (2420005 < 2421005)
          return String(a?.item_no ?? '').localeCompare(String(b?.item_no ?? ''));
        });

      // ✅ 거래처 이력 조회 (is_new_item 판단용)
      const clientHistory = db
        .prepare(`SELECT item_no FROM client_item_stats WHERE client_code = ?`)
        .all(clientCode) as Array<{ item_no: string }>;
      const clientItemSet = new Set(clientHistory.map(r => String(r.item_no)));
      
      console.log(`[거래처이력] ${clientCode}: ${clientHistory.length}개 품목, 샘플: ${Array.from(clientItemSet).slice(0, 5).join(', ')}`);

      // ⭐ 1단계: 기존 입고 품목에 점수 부스트 적용 (검색 결과에 포함되도록)
      const boostedCandidates = sortedCandidates.map((c: any) => {
        const isInClientHistory = clientItemSet.has(String(c.item_no));
        // 기존 입고 품목은 점수에 +0.15 부스트 (top 결과에 포함되도록)
        const boostedScore = isInClientHistory ? (c.score ?? 0) + 0.15 : (c.score ?? 0);
        console.log(`[점수부스트] ${c.item_no}: ${(c.score ?? 0).toFixed(3)} → ${boostedScore.toFixed(3)} (기존입고: ${isInClientHistory})`);
        return {
          ...c,
          score: boostedScore,
          original_score: c.score ?? 0, // 원래 점수 보관
          is_new_item: c.is_new_item ?? !isInClientHistory,
        };
      });
      
      // 점수 기준으로 재정렬
      boostedCandidates.sort((a: any, b: any) => (b.score ?? 0) - (a.score ?? 0));

      // 기본 suggestions 초기화 (부스트 적용된 후보에서)
      let suggestions = boostedCandidates.slice(0, config.suggestions.total).map((c: any) => {
        console.log(`[후보선택] ${c.item_no} ${c.item_name}: score=${c.score?.toFixed(3)}, is_new_item=${c.is_new_item}`);
        return c;
      });

      // 🆕 신규 품목 검색: Wine 페이지에서만 English 시트 검색
      if (pageType === "wine") {
        const bestScore = boostedCandidates.length > 0 ? boostedCandidates[0]?.original_score ?? 0 : 0; // 원래 점수 사용
        const inputName = x.name || '';
        
        // ✅ 중앙 설정에서 임계값 가져오기
        if (bestScore < config.newItemSearch.threshold && inputName) {
          console.log(`[신규품목] 검색 시도: "${inputName}", bestScore=${bestScore.toFixed(3)}`);
          
          // 신규 품목 검색 시도
          const newItemCandidates = searchNewItem(clientCode, inputName, bestScore, config.newItemSearch.threshold);
          
          if (newItemCandidates && newItemCandidates.length > 0) {
            console.log(`[신규품목] English 시트에서 ${newItemCandidates.length}개 발견`);
            
            // ✅ GAP 기반 후보 조합 결정
            const composition = decideSuggestionComposition(boostedCandidates, newItemCandidates);
            
            console.log(`[후보조합] ${composition.type}: 기존 ${composition.existing}개 + 신규 ${composition.newItems}개 (${composition.reason})`);
            
            // ✅ 신규품목 점수가 충분히 높을 때만 조합 적용
            // 그렇지 않으면 기존 품목을 전부 표시 (신규품목은 무시)
            const newItemBestScore = newItemCandidates[0]?.score ?? 0;
            const existingBestScore = boostedCandidates[0]?.original_score ?? 0; // 원래 점수 사용
            const shouldIncludeNewItems = newItemBestScore >= existingBestScore * 0.7; // 신규품목이 기존의 70% 이상
            
            if (!shouldIncludeNewItems) {
              console.log(`[후보조합] 신규품목 점수 낮음 (${newItemBestScore.toFixed(3)} < ${existingBestScore.toFixed(3)} * 0.7) → 기존품목 ${config.suggestions.total}개만 표시`);
              // 기존 품목만 표시 (composition 무시)
              suggestions = boostedCandidates.slice(0, config.suggestions.total); // 이미 is_new_item 설정됨
            } else {
              console.log(`[후보조합] 신규품목 포함 (${newItemBestScore.toFixed(3)} >= ${existingBestScore.toFixed(3)} * 0.7)`);
            
              // ✅ 기존 후보도 is_new_item 추가
              const existingSuggestions = boostedCandidates.slice(0, composition.existing); // 이미 is_new_item 설정됨
              
              // 신규품목 매핑 (신규품목 플래그 포함)
              const newItemSuggestions = newItemCandidates.slice(0, composition.newItems).map((c) => {
                const isInClientHistory = clientItemSet.has(String(c.itemNo));
                return {
                  item_no: c.itemNo,
                  item_name: `${c.koreanName} / ${c.englishName}${c.vintage ? ` (${c.vintage})` : ''}`,
                  score: c.score,
                  source: 'master_sheet',
                  is_new_item: !isInClientHistory, // ✅ 거래처 이력 기반 판단
                  supply_price: c.supplyPrice,
                  _debug: c._debug,
                };
              });
              
              // 조합에 따라 후보 구성 후 점수 순으로 재정렬
              const allSuggestions = [
                ...existingSuggestions,
                ...newItemSuggestions
              ];
              
              // ✅ 중복 제거 (같은 품목 코드면 기존 입고품목 우선)
              // 1단계: item_no 기준으로 중복 제거 + 기존 입고품목 우선
              const groupByItemNo = new Map<string, any[]>();
              for (const s of allSuggestions) {
                const itemNo = String(s.item_no || '');
                if (!itemNo) continue; // item_no 없으면 스킵
                
                if (!groupByItemNo.has(itemNo)) {
                  groupByItemNo.set(itemNo, []);
                }
                groupByItemNo.get(itemNo)!.push(s);
              }
              
              const dedupedByItemNo: any[] = [];
              for (const [itemNo, group] of Array.from(groupByItemNo.entries())) {
                if (group.length === 1) {
                  dedupedByItemNo.push(group[0]);
                } else {
                  // ✅ 같은 item_no가 여러 개면: 기존 입고품목 우선 (is_new_item === false)
                  const existingItems = group.filter(s => s.is_new_item === false);
                  const newItems = group.filter(s => s.is_new_item === true);
                  
                  if (existingItems.length > 0) {
                    // 기존 품목이 있으면 기존 품목만 표시 (점수 높은 것 우선)
                    const best = existingItems.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
                    console.log(`[중복제거] item_no=${itemNo}: 기존 입고품목 우선 (${existingItems.length}개 중 선택) - ${best.item_name}`);
                    dedupedByItemNo.push(best);
                  } else {
                    // 기존 품목이 없으면 신규 품목 중 점수 높은 것
                    const best = newItems.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
                    dedupedByItemNo.push(best);
                  }
                }
              }
              
              // 2단계: 품목명 기준으로 그룹화 (빈티지 중복 제거)
              const groupByName = new Map<string, any[]>();
              for (const s of dedupedByItemNo) {
                const baseNameWithoutVintage = removeVintageFromName(s.item_name || '');
                if (!groupByName.has(baseNameWithoutVintage)) {
                  groupByName.set(baseNameWithoutVintage, []);
                }
                groupByName.get(baseNameWithoutVintage)!.push(s);
              }
              
              // 3단계: 각 그룹에서 빈티지 선택 (기존 + 신규 빈티지 모두 표시)
              const deduped: any[] = [];
              for (const [baseName, group] of Array.from(groupByName.entries())) {
                if (group.length === 1) {
                  deduped.push(group[0]);
                } else {
                  // 빈티지 정보 추가
                  const withVintage = group.map(s => ({
                    ...s,
                    _vintage: extractVintage(s.item_no)
                  }));
                  
                  // 기존 품목과 신규 품목 분리
                  const existingItems = withVintage.filter(s => s.is_new_item === false);
                  const newItems = withVintage.filter(s => s.is_new_item === true);
                  
                  // 🔥 수정: 기존 품목이 있고 신규 품목도 있으면 둘 다 표시!
                  if (existingItems.length > 0 && newItems.length > 0) {
                    // 기존 품목: 최신 빈티지 선택
                    const existingSorted = existingItems.sort((a, b) => {
                      if (a._vintage && b._vintage) return b._vintage - a._vintage;
                      return (b.score ?? 0) - (a.score ?? 0);
                    });
                    
                    // 신규 품목: 최신 빈티지 선택
                    const newSorted = newItems.sort((a, b) => {
                      if (a._vintage && b._vintage) return b._vintage - a._vintage;
                      return (b.score ?? 0) - (a.score ?? 0);
                    });
                    
                    console.log(`[빈티지중복] ${baseName}: 기존(${existingSorted[0].item_no}) + 신규(${newSorted[0].item_no}) 모두 표시`);
                    deduped.push(existingSorted[0]); // 기존 품목 추가
                    deduped.push(newSorted[0]);      // 신규 빈티지 추가
                  } 
                  // 기존 품목만 있거나 신규 품목만 있으면 최신 빈티지 선택
                  else {
                    const sorted = withVintage.sort((a, b) => {
                      // 1순위: 기존 품목 우선
                      const aIsExisting = a.is_new_item === false;
                      const bIsExisting = b.is_new_item === false;
                      if (aIsExisting && !bIsExisting) return -1;
                      if (!aIsExisting && bIsExisting) return 1;
                      
                      // 2순위: 빈티지가 있으면 최신 우선
                      if (a._vintage && b._vintage) {
                        return b._vintage - a._vintage;
                      }
                      return (b.score ?? 0) - (a.score ?? 0);
                    });
                    
                    const selected = sorted[0];
                    if (group.length > 1) {
                      const isExisting = selected.is_new_item === false;
                      console.log(`[빈티지중복] ${baseName}: ${selected.item_no} 선택 (${isExisting ? '기존품목' : '신규빈티지'} ${selected._vintage || ''}) - ${group.length}개 중`);
                    }
                    deduped.push(selected);
                  }
                }
              }
              
              // ✅ 기존 품목 우선 정렬 → 각 그룹 내에서 점수 내림차순
              suggestions = deduped
                .sort((a: any, b: any) => {
                  // 1순위: 기존 품목 (is_new_item=false)을 위로
                  const aIsExisting = a.is_new_item === false;
                  const bIsExisting = b.is_new_item === false;
                  if (aIsExisting && !bIsExisting) return -1;
                  if (!aIsExisting && bIsExisting) return 1;
                  
                  // 2순위: 같은 그룹(기존 or 신규) 내에서는 점수 내림차순
                  return (b.score ?? 0) - (a.score ?? 0);
                })
                .slice(0, config.suggestions.total);
              
              console.log(`[최종정렬] 기존품목 우선 → 점수순:`, suggestions.map((s: any) => ({ 
                no: s.item_no, 
                score: s.score?.toFixed(3), 
                isNew: s.is_new_item || false 
              })));
              
              // 🔍 디버깅: 첫 번째 항목이 기존 품목인지 확인
              if (suggestions.length > 0) {
                const first = suggestions[0];
                console.log(`[정렬검증] 1번 항목:`, {
                  item_no: first.item_no,
                  is_new_item: first.is_new_item,
                  expected: '기존 품목이어야 함'
                });
              }

              // ✅ 신규 품목 정보 저장 (resolved 재판단 후 반환)
              x.has_new_items = composition.newItems > 0;
              x.new_item_info = composition.newItems > 0 ? {
                message: '신규 품목이 포함되어 있습니다.',
                source: 'order-ai.xlsx (English)',
              } : undefined;
            }
          } else {
            console.log(`[신규품목] English 시트 결과 없음 - 기존품목 ${config.suggestions.total}개 표시`);
          }
        }
      }

      // ✅ 중복 제거 후 resolved 재판단
      let resolved = x?.resolved ?? false;
      
      // ✅ resolved인데 item_no가 없으면 무조건 false로 변경
      if (resolved && !x?.item_no) {
        console.log(`[AutoResolve] ${x.name}: resolved=true인데 item_no 없음 → resolved=false로 변경`);
        resolved = false;
        x = { ...x, resolved: false };  // x 객체도 업데이트
      }
      
      // 중복 제거된 suggestions로 다시 판단
      if (!resolved && suggestions.length > 0) {
        const top = suggestions[0];
        const second = suggestions[1];
        const gap = second ? (top.score ?? 0) - (second.score ?? 0) : 999;
        
        // ✅ 신규 품목은 자동 확정하지 않음
        const isNewItem = top.is_new_item ?? false;
        
        if (isNewItem) {
          // 신규 품목: 자동 확정 안 함
          resolved = false;
          console.log(`[AutoResolve] ${x.name}: 신규품목이므로 수동 확인 필요 (score=${(top.score ?? 0).toFixed(3)}, is_new_item=true)`);
        } else {
          // 기존 품목: 자동 확정 조건 (중앙 설정 사용)
          const minScore = config.autoResolve?.minScore ?? 0.60;
          const minGap = config.autoResolve?.minGap ?? 0.20;
          // ✅ item_no가 있고, 점수와 gap 조건을 만족할 때만 자동 확정
          resolved = top.item_no && (top.score ?? 0) >= minScore && gap >= minGap;
          
          console.log(`[AutoResolve] ${x.name}: item_no=${top.item_no}, score=${(top.score ?? 0).toFixed(3)}, gap=${gap.toFixed(3)}, resolved=${resolved}`);
        }
      }

      // ✅ resolved가 true로 변경되었고, suggestions가 있으면 top item_no로 업데이트
      console.log(`[ITEM DEBUG] Before resultItem:`, {
        name: x.name,
        resolved,
        x_item_no: x.item_no,
        x_resolved: x.resolved,
        suggestions_length: suggestions.length,
        top_item_no: suggestions[0]?.item_no
      });
      
      const resultItem: any = {
        ...x,
        resolved,
        suggestions,
        candidates: suggestions, // ✅ 프론트엔드 호환성: candidates도 동일하게 설정
      };
      
      if (resolved && suggestions.length > 0 && suggestions[0].item_no) {
        console.log(`[ITEM DEBUG] Updating item_no: ${suggestions[0].item_no}`);
        resultItem.item_no = suggestions[0].item_no;
        resultItem.item_name = suggestions[0].item_name;
        resultItem.score = suggestions[0].score;
      }
      
      console.log(`[ITEM DEBUG] After resultItem:`, {
        name: resultItem.name,
        resolved: resultItem.resolved,
        item_no: resultItem.item_no,
        item_name: resultItem.item_name?.substring(0, 30)
      });

      return resultItem;
    });

    // ✅ 같은 item_no를 가진 아이템 통합 (수량 합산)
    const mergedItems = (() => {
      const itemMap = new Map<string, any>();
      for (const item of itemsWithSuggestions) {
        console.log(`[MERGE DEBUG] Processing item:`, {
          resolved: item.resolved,
          item_no: item.item_no,
          item_name: item.item_name?.substring(0, 30),
          quantity: item.quantity
        });
        
        if (item.resolved && item.item_no) {
          const key = String(item.item_no);
          const existing = itemMap.get(key);
          if (existing) {
            // 같은 품목이 여러 번 확정된 경우 수량 합산
            console.log(`[MERGE DEBUG] ✅ 중복 발견! ${key} - 수량 합산: ${existing.quantity} + ${item.quantity} = ${(existing.quantity || 0) + (item.quantity || 0)}`);
            existing.quantity = (existing.quantity || 0) + (item.quantity || 0);
          } else {
            console.log(`[MERGE DEBUG] 새 아이템 추가: ${key}`);
            itemMap.set(key, { ...item });
          }
        } else {
          // 미확정 아이템은 그대로 추가 (중복 체크 안 함)
          const unresolvedKey = `unresolved_${Date.now()}_${Math.random()}`;
          console.log(`[MERGE DEBUG] 미확정 아이템 추가: ${unresolvedKey}`);
          itemMap.set(unresolvedKey, { ...item });
        }
      }
      return Array.from(itemMap.values());
    })();

    console.log("[EXISTING CLIENT] mergedItems:", JSON.stringify(mergedItems, null, 2));

    // 4) 상태 결정
    const hasUnresolved = mergedItems.some((x: any) => !x.resolved);

    return jsonResponse({
      success: true,
      status: hasUnresolved ? "needs_review_items" : "resolved",
      client,
      parsed_items: mergedItems, // ✅ suggestions 포함된 배열 반환

      // ✅ 여기 핵심: suggestions가 들어간 배열을 내려줘야 UI에서 3개 옵션이 뜸
      items: mergedItems,

      // ✅ 직원 메시지는 기존과 동일하게 동작 (unresolved는 여전히 확인필요로 표기)
      staff_message: formatStaffMessage(client, mergedItems, {
        customDeliveryDate: body?.customDeliveryDate,
        requirePaymentConfirm: body?.requirePaymentConfirm,
        requireInvoice: body?.requireInvoice,
      }),

      debug: {
        preprocessed_message: preMessage,
        translation_message: trMsg.translated ? "translated" : "no",
        preprocessed_orderText: orderPre,
        translation_order: trOrder.translated ? "translated" : "no",
      },
    } as any);
  } catch (e: any) {
    console.error("[parse-full-order] ERROR:", e);
    console.error("[parse-full-order] Stack:", e?.stack);
    return jsonResponse(
      { success: false, error: String(e?.message || e) } as any,
      { status: 500 }
    );
  }
}

