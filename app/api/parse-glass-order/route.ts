import { NextResponse } from "next/server";
import { jsonResponse } from "@/app/lib/api-response";
import { db } from "@/app/lib/db";
import { parseGlassItemsFromMessage } from "@/app/lib/parseGlassItems";
import { resolveGlassItemsByClient } from "@/app/lib/resolveGlassItems";
import { syncFromXlsxIfNeeded, syncGlassFromXlsxIfNeeded } from "@/app/lib/syncFromXlsx";
import { translateOrderToKoreanIfNeeded } from "@/app/lib/translateOrder";


import Holidays from "date-holidays";

export const runtime = "nodejs";

function cleanClientCode(code: any) {
  return String(code || "").replace(/\.0$/, "");
}

/* -------------------- Glass 전용 preprocess -------------------- */
// ✅ Glass는 와인과 다른 특수한 패턴:
// 1. 슬래시(/)를 줄바꿈으로 바꾸면 안 됨 (0447/07 같은 코드)
// 2. 괄호와 콜론 패턴 유지 (0447/07(레스토랑) : 12잔)
function preprocessGlassMessage(text: string) {
  let s = String(text || "");

  // 통일
  s = s.replace(/\r/g, "\n");

  // 인사말/군더더기 제거
  s = s.replace(/안녕하세요\.?|안녕하십니까\.?/g, " ");
  s = s.replace(
    /(부탁드려요|부탁드립니다|부탁드리겠습니다|드리겠습니다|부탁해요|주세요|주문합니다|주문드려요|주문드립니다|발주\s*요청|발주\s*부탁)\.?/g,
    " "
  );
  s = s.replace(/(감사합니다|고맙습니다)\.?/g, " ");

  // ✅ Glass는 슬래시를 유지 (코드 때문)
  // s = s.replace(/\s*\/\s*/g, "\n");  // ❌ 이걸 하면 0447/07이 깨짐

  // ✅ 콤마 구분 지원: "0330/07 6, 0330/15 6" → 줄바꿈 분리
  // 단, 품목명 내부 콤마(예: "카베르네/메를로, 시라")는 보호
  // 콤마 뒤에 숫자나 코드 패턴이 오면 줄바꿈으로 변환
  s = s.replace(/,\s*(?=\d{3,4}\/)/g, "\n");  // 콤마 뒤에 코드패턴
  s = s.replace(/,\s*(?=[가-힣]{2})/g, "\n");  // 콤마 뒤에 한글 품목명

  // 문장부호만 줄바꿈으로
  s = s.replace(/[.!?]/g, "\n");

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
  const toks = extractKoreanTokens(input)
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
  const b = norm(nRaw);
  if (!a || !b) return 0;

  // ✅ (0) 괄호 안 상호명 우선 매칭 - 최우선 처리! (오타 허용)
  const nameAlias = nRaw.match(/\(([^)]+)\)/);
  if (nameAlias) {
    const aliasText = nameAlias[1].trim();
    const aliasNorm = norm(aliasText);
    
    // 완전 일치
    if (a === aliasNorm) return 1.0;
    
    // 포함 관계
    if (aliasNorm.includes(a) || a.includes(aliasNorm)) {
      return 0.98;
    }
    
    // ✅ 유사도 기반 매칭 (오타 허용)
    // 문자 겹침 비율 계산
    const aChars = new Set(a.split(""));
    const aliasChars = new Set(aliasNorm.split(""));
    let common = 0;
    for (const ch of aChars) {
      if (aliasChars.has(ch)) common++;
    }
    const similarity = common / Math.max(a.length, aliasNorm.length);
    
    // 70% 이상 유사하면 괄호 안 상호명으로 간주
    if (similarity >= 0.7) {
      // 길이 차이 보정
      const lenDiff = Math.abs(a.length - aliasNorm.length);
      const lenPenalty = lenDiff * 0.02; // 길이 차이당 -0.02
      const score = Math.max(0.85, Math.min(0.97, 0.95 - lenPenalty));
      return score;
    }
  }

  // ✅ (A) 브랜드 게이트: 입력의 핵심 토큰이 후보에 없으면 고득점 금지
  const brand = pickBrandToken(qRaw); // 예: "스시소라"
  if (brand) {
    const brandNorm = norm(brand);
    
    // ✅ 괄호 안의 별칭도 검색 대상에 포함
    const nameMainText = nRaw.replace(/\([^)]+\)/g, "").trim();
    const nameAliasText = nameAlias ? nameAlias[1].trim() : "";
    
    const nameMainNorm = norm(nameMainText);
    const nameAliasNorm = norm(nameAliasText);
    
    // 브랜드가 메인 텍스트나 괄호 안 별칭 어디에도 없으면 점수 제한
    if (brandNorm && !b.includes(brandNorm) && !nameMainNorm.includes(brandNorm) && !nameAliasNorm.includes(brandNorm)) {
      return 0.45;
    }
  }

  // ✅ (B) 지점(청담/판교/광교...) 토큰은 "브랜드가 맞는 후보들" 안에서만 가산/감점
  const extractBranchTokens = (s: string) =>
    extractKoreanTokens(s)
      .map((t) => t.replace(/(지점|점|본점)$/g, ""))
      .filter(Boolean);

  const stop2 = new Set(["주식회사", brand]); // 브랜드 토큰은 branch 토큰에서 제외
  const qTokens = extractBranchTokens(qRaw).filter((t) => !stop2.has(t));
  const nTokens = extractBranchTokens(nRaw).filter((t) => !stop2.has(t));

  let branchAdj = 0;
  if (qTokens.length > 0) {
    const hasAny = qTokens.some((t) => nTokens.includes(t));
    if (hasAny) branchAdj += 0.18;

    // 입력 지점이 있는데 후보 지점이 다르면 감점 (청담 vs 광교 같은 케이스)
    const hasMismatch = nTokens.some((t) => !qTokens.includes(t));
    if (!hasAny && hasMismatch) branchAdj -= 0.25;
  }

  // ✅ (C) 기존 기본 점수 (포함/겹침)
  if (a === b) return 1.0;

  if (b.includes(a) || a.includes(b)) {
    const s = Math.max(0, Math.min(0.99, 0.9 + branchAdj));
    return s;
  }

  const aset = new Set(a.split(""));
  let common = 0;
  for (const ch of aset) if (b.includes(ch)) common++;
  const overlap = common / Math.max(6, a.length);
  const base = Math.max(0, Math.min(0.89, overlap));

  const s = Math.max(0, Math.min(0.99, base + branchAdj));
  return s;
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
  const kst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));

  const day = kst.getDay(); // 0=일, 5=금
  const hour = kst.getHours();
  const minute = kst.getMinutes();

  let addDays = 1;
  const afterCutoff = hour > 16 || (hour === 16 && minute >= 31);

  if (afterCutoff) addDays = 2;
  if (day === 5 && afterCutoff) addDays = 4; // 금요일 16:31 이후 → 화요일

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
  const rows = db
    .prepare(`SELECT client_code, alias, weight FROM glass_client_alias`)
    .all() as Array<{ client_code: any; alias: any; weight?: any }>;

  const candidate = String(clientText || "").trim() || firstLine(message);

  // ✅ 1순위: 거래처 코드 직접 매칭 (12096 같은 숫자)
  if (candidate && /^\d+$/.test(candidate)) {
    // 먼저 alias 테이블에서 검색
    const codeMatch = rows.find((r) => String(r.client_code) === candidate);
    if (codeMatch) {
      return {
        status: "resolved",
        client_code: String(codeMatch.client_code),
        client_name: String(codeMatch.alias),
        method: "exact_code",
      };
    }

    // alias에 없으면 glass_clients 테이블에서 직접 검색
    const directClient = db
      .prepare(`SELECT client_code, client_name FROM glass_clients WHERE client_code = ?`)
      .get(candidate) as any;
    
    if (directClient) {
      return {
        status: "resolved",
        client_code: String(directClient.client_code),
        client_name: String(directClient.client_name),
        method: "exact_code_direct",
      };
    }
  }

  // ✅ 2순위: 거래처명 exact 매칭
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
    top && top.score >= 0.93 && (!second || top.score - second.score >= 0.08);
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
    // ✅ clientText가 있고 orderText가 없으면 message에서 clientText 제거한 나머지를 orderText로 사용
    const effectiveOrder = orderText
      ? String(orderText)
      : String(message || "").replace(/\r/g, "").split("\n")
          .filter(l => l.trim() && l.trim() !== String(clientText).trim())
          .join("\n");
    return {
      rawMessage: String(message || ""),
      clientText: String(clientText || ""),
      orderText: effectiveOrder,
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

// ✅ Glass 품목 단위 결정 함수
// "개" 단위: 디캔터, 박스, 쇼핑백, 클리너, 캐링백, 세트, 밸류팩, 클로스, 린넨
// "잔" 단위: 그 외 모든 RD 와인잔 (0xxx, 4xxx, 6xxx 등 모든 시리즈)
function getGlassUnit(itemName: string): string {
  // 1. 명확한 "개" 단위 품목 키워드 (부자재/악세서리)
  if (/디캔터|박스|쇼핑백|클리너|캐링백|세트|밸류팩|폴리싱|클로스|린넨|보틀\s*클리너/i.test(itemName)) {
    return "개";
  }

  // 2. RD 코드가 있는 와인잔 → 잔 (모든 시리즈: 0xxx, 4xxx, 6xxx 등)
  // ✅ (?:[A-Z][A-Z0-9]*)? : 알파벳으로 시작하는 영숫자 혼합 접미사(JG,SKY,BWT,MA,S3 등) 지원
  const rdMatch = itemName.match(/RD\s+(\d{4}\/\d{1,3}(?:[A-Z][A-Z0-9]*)?)/i);
  if (rdMatch) {
    return "잔";
  }

  // 3. 품목명에 "레스토랑" 포함 → 잔
  if (/레스토랑/i.test(itemName)) {
    return "잔";
  }

  // 4. 코드만 입력된 경우 (330/07, 0330/07, 4900/28JG 등) → 잔
  const codeOnly = itemName.match(/^0?\d{3,4}\/\d{1,3}(?:[A-Z][A-Z0-9]*)?$/i);
  if (codeOnly) {
    return "잔";
  }

  // 5. 나머지 → 개
  return "개";
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
  lines.push(
    `거래처: ${client.client_name} (${cleanClientCode(client.client_code)})`
  );
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
    const unit = getGlassUnit(it.item_name || it.name || "");
    
    if (it.resolved) {
      lines.push(`- ${it.item_no} / ${it.item_name} / ${it.qty}${unit}`);
    } else {
      lines.push(`- 확인필요 / "${it.name}" / ${it.qty}${unit}`);
    }
  }

  lines.push("");
  lines.push("발주 요청드립니다.");
  return lines.join("\n");
}

export async function POST(req: Request) {
  // ✅ 엑셀 자동 동기화 (파일 변경 시에만 실행)
  const sync = syncFromXlsxIfNeeded();
  const glassSync = syncGlassFromXlsxIfNeeded();
  console.log("[XLSX SYNC]", sync, "[GLASS SYNC]", glassSync);

  try {
    const body = await req.json().catch(() => ({}));
    const forceResolve = Boolean(body?.force_resolve);
    
    // ✅ 신규 사업자 처리
    const newBusiness = body?.newBusiness;
    if (newBusiness && newBusiness.name && newBusiness.phone) {
      console.log("[NEW BUSINESS]", newBusiness);
      
      // 품목만 파싱
      const pre0 = preprocessGlassMessage(body?.message ?? "");
      const trMsg = await translateOrderToKoreanIfNeeded(pre0);
      const preMessage = trMsg.translated ? trMsg.text : pre0;
      const parsedItems = parseGlassItemsFromMessage(preMessage);
      
      // 거래처 정보는 신규 사업자로 설정
      const client = {
        status: "resolved" as const,
        client_name: newBusiness.name,
        client_code: "NEW",
        phone: newBusiness.phone,
        email: newBusiness.email, // 이메일 추가
      };
      
      // 신규 사업자는 이력 없음 → master만 검색
      const resolvedItems = resolveGlassItemsByClient("NEW", parsedItems, {
        minScore: 0.55,
        minGap: 0.05,
        topN: 5,
      });
      
      // suggestions 추가
      const itemsWithSuggestions = resolvedItems.map((x: any) => {
        if (x?.resolved) return x;
        const suggestions = Array.isArray(x?.suggestions) 
          ? x.suggestions 
          : Array.isArray(x?.candidates)
            ? x.candidates.slice(0, 3)
            : [];
        return { ...x, suggestions };
      });
      
      const hasUnresolved = itemsWithSuggestions.some((x: any) => !x.resolved);
      
      // 직원 메시지 생성
      const staffMessage = formatStaffMessage(
        client,
        itemsWithSuggestions,
        {
          customDeliveryDate: body?.customDeliveryDate,
          requirePaymentConfirm: body?.requirePaymentConfirm,
          requireInvoice: body?.requireInvoice,
        }
      );
      
      return jsonResponse({
        success: true,
        status: hasUnresolved ? "needs_review_items" : "resolved",
        client,
        parsed_items: parsedItems,
        items: itemsWithSuggestions,
        staff_message: staffMessage,
        is_new_business: true,
      });
    }

    // ✅ 0) 전체 메시지 전처리 먼저
    const pre0 = preprocessGlassMessage(body?.message ?? "");

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
      });
    }

    // 2) 품목 파싱 (orderText도 한번 더 전처리)
    console.log(`[Glass DEBUG] orderText="${orderText}", rawMessage="${rawMessage.substring(0,50)}"`);
    let order0 = preprocessGlassMessage(orderText || rawMessage);
    console.log(`[Glass DEBUG] order0 after preprocess="${order0}"`);

    // ✅ 2-0) 거래처명이 품목 텍스트에 섞여있으면 제거
    // 한 줄 입력 "크로스비 0425/0 6" → client 해결 후 "크로스비"를 제거하여 "0425/0 6"로 만듦
    if (client.status === "resolved" && client.client_name) {
      const clientName = String((client as any).client_name || "");
      if (clientName) {
        // 각 줄에서 거래처명이 앞에 붙어있으면 제거
        order0 = order0
          .split("\n")
          .map((line) => {
            const trimmed = line.trim();
            // 거래처명으로 시작하는 경우 제거 (또는 거래처명만 있는 줄 완전 제거)
            if (trimmed.startsWith(clientName)) {
              const rest = trimmed.slice(clientName.length).trim();
              return rest || ""; // 빈 문자열은 filter(Boolean)에서 제거됨
            }
            // ✅ 거래처명과 정규화 후 일치하면 완전 제거
            if (norm(trimmed) === norm(clientName)) {
              return "";
            }
            // norm 비교: 거래처명이 다양한 형태로 붙을 수 있음
            const clientNorm = norm(clientName);
            const lineTokens = trimmed.split(/\s+/);
            if (lineTokens.length > 1) {
              // ✅ 2토큰 결합 비교 우선 (예: "스시소라 광교" → 거래처명)
              if (lineTokens.length > 2) {
                const twoTokens = lineTokens.slice(0, 2).join(" ");
                const twoTokenNorm = norm(twoTokens);
                if (twoTokenNorm === clientNorm || clientNorm.includes(twoTokenNorm) || twoTokenNorm.includes(clientNorm)) {
                  return lineTokens.slice(2).join(" ");
                }
              }
              // 1토큰 비교
              const firstToken = lineTokens[0];
              if (norm(firstToken) === clientNorm || clientNorm.includes(norm(firstToken)) || norm(firstToken).includes(clientNorm)) {
                return lineTokens.slice(1).join(" ");
              }
            }
            return trimmed;
          })
          .filter(Boolean)
          .join("\n");
        console.log(`[Glass] 거래처명 제거 후 orderText: "${order0}"`);
      }
    }

    // ✅ 2-1) 번역(영어 비중 높을 때만)
    const trOrder = await translateOrderToKoreanIfNeeded(order0);
    const orderPre = trOrder.translated ? trOrder.text : order0;

    const parsedItems = parseGlassItemsFromMessage(orderPre);

    const clientCode = client?.client_code;
    if (!clientCode) {
      return jsonResponse({
        success: true,
        status: "needs_review_client",
        client,
        error: "client_code가 없어 품목 resolve를 진행할 수 없습니다.",
      });
    }

    // 3) 품목 resolve
    const resolvedItems = resolveGlassItemsByClient(clientCode, parsedItems, {
      minScore: 0.55,
      minGap: 0.05,
      topN: 5,
    });

    // ✅ 3-1) unresolved인 품목에 후보 3개(suggestions) 붙이기 (UI용)
    //     - resolveGlassItemsByClient가 이미 suggestions를 만들었으므로 그대로 사용
    const itemsWithSuggestions = resolvedItems.map((x: any) => {
      if (x?.resolved) return x;

      // suggestions가 이미 있으면 그대로 사용 (is_new_item, price 포함)
      const suggestions = Array.isArray(x?.suggestions) 
        ? x.suggestions 
        : Array.isArray(x?.candidates)
          ? x.candidates.slice(0, 3)
          : [];

      return {
        ...x,
        suggestions, // ✅ UI는 이걸로 3개 선택 띄우면 됨
      };
    });

    // 4) 상태 결정
    const hasUnresolved = itemsWithSuggestions.some((x: any) => !x.resolved);

    return jsonResponse({
      success: true,
      status: hasUnresolved ? "needs_review_items" : "resolved",
      client,
      parsed_items: parsedItems,

      // ✅ 여기 핵심: suggestions가 들어간 배열을 내려줘야 UI에서 3개 옵션이 뜸
      items: itemsWithSuggestions,

      // ✅ 직원 메시지는 기존과 동일하게 동작 (unresolved는 여전히 확인필요로 표기)
      staff_message: formatStaffMessage(client, itemsWithSuggestions, {
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
    });
  } catch (e: any) {
    return jsonResponse(
      { success: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
