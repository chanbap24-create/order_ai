import { NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { parseGlassItemsFromMessage } from "@/app/lib/parseGlassItems";
import { resolveGlassItemsByClient } from "@/app/lib/resolveGlassItems";
import { syncFromXlsxIfNeeded } from "@/app/lib/syncFromXlsx";
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

  // ✅ (A) 브랜드 게이트: 입력의 핵심 토큰이 후보에 없으면 고득점 금지
  const brand = pickBrandToken(qRaw); // 예: "스시소라"
  if (brand) {
    const brandNorm = norm(brand);
    if (brandNorm && !b.includes(brandNorm)) {
      // 브랜드가 없으면 점수 상한을 낮게 캡 (지점만 맞아도 상위 못 오게)
      // 여기 값을 0.35~0.55 사이에서 운영취향대로 조절 가능
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
    const codeMatch = rows.find((r) => String(r.client_code) === candidate);
    if (codeMatch) {
      return {
        status: "resolved",
        client_code: String(codeMatch.client_code),
        client_name: String(codeMatch.alias),
        method: "exact_code",
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

// ✅ Glass 품목 단위 결정 함수
function getGlassUnit(itemName: string): string {
  // 1. 품목명에 "레스토랑" 포함 → 잔
  if (/레스토랑/i.test(itemName)) {
    return "잔";
  }

  // 2. RD 코드가 0으로 시작 (0447/07, 0884/67 등) → 잔
  const rdMatch = itemName.match(/RD\s+(\d{4}\/\d{1,2}[A-Z]?)/i);
  if (rdMatch) {
    const code = rdMatch[1];
    if (code.startsWith("0")) {
      return "잔";
    }
  }

  // 3. 나머지 → 개
  return "개";
}

function formatStaffMessage(client: any, items: any[]) {
  const delivery = getDeliveryDateKST();

  const lines: string[] = [];
  lines.push(
    `거래처: ${client.client_name} (${cleanClientCode(client.client_code)})`
  );
  lines.push(`배송 예정일: ${delivery.label}`);
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
  console.log("[XLSX SYNC]", sync);

  try {
    const body = await req.json().catch(() => ({}));
    const forceResolve = Boolean(body?.force_resolve);

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
      return NextResponse.json({
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
    const order0 = preprocessGlassMessage(orderText || rawMessage);

    // ✅ 2-1) 번역(영어 비중 높을 때만)
    const trOrder = await translateOrderToKoreanIfNeeded(order0);
    const orderPre = trOrder.translated ? trOrder.text : order0;

    const parsedItems = parseGlassItemsFromMessage(orderPre);

    const clientCode = client?.client_code;
    if (!clientCode) {
      return NextResponse.json({
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
    //     - 새로 DB에서 찾지 말고, resolveGlassItemsByClient가 만든 candidates를 그대로 사용
    const itemsWithSuggestions = resolvedItems.map((x: any) => {
      if (x?.resolved) return x;

      // candidates가 있으면 상위 3개를 suggestions로 노출
      const candidates = Array.isArray(x?.candidates) ? x.candidates : [];

      // 혹시 정렬이 보장 안 되면 score 기준으로 정렬
      const suggestions = candidates
        .slice()
        .sort((a: any, b: any) => (b?.score ?? 0) - (a?.score ?? 0))
        .slice(0, 3);

      return {
        ...x,
        suggestions, // ✅ UI는 이걸로 3개 선택 띄우면 됨
      };
    });

    // 4) 상태 결정
    const hasUnresolved = itemsWithSuggestions.some((x: any) => !x.resolved);

    return NextResponse.json({
      success: true,
      status: hasUnresolved ? "needs_review_items" : "resolved",
      client,
      parsed_items: parsedItems,

      // ✅ 여기 핵심: suggestions가 들어간 배열을 내려줘야 UI에서 3개 옵션이 뜸
      items: itemsWithSuggestions,

      // ✅ 직원 메시지는 기존과 동일하게 동작 (unresolved는 여전히 확인필요로 표기)
      staff_message: formatStaffMessage(client, itemsWithSuggestions),

      debug: {
        preprocessed_message: preMessage,
        translation_message: trMsg.translated ? "translated" : "no",
        preprocessed_orderText: orderPre,
        translation_order: trOrder.translated ? "translated" : "no",
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
