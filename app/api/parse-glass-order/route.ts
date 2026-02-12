import { NextResponse } from "next/server";
import { jsonResponse } from "@/app/lib/api-response";
import { supabase } from "@/app/lib/db";
import { parseGlassItemsFromMessage } from "@/app/lib/parseGlassItems";
import { resolveGlassItemsByClient } from "@/app/lib/resolveGlassItems";
import { syncFromXlsxIfNeeded, syncGlassFromXlsxIfNeeded } from "@/app/lib/syncFromXlsx";
import { translateOrderToKoreanIfNeeded } from "@/app/lib/translateOrder";


import { isHolidayKST } from "@/app/lib/holidays";

function cleanClientCode(code: any) {
  return String(code || "").replace(/\.0$/, "");
}

/* -------------------- Glass 전용 preprocess -------------------- */
function preprocessGlassMessage(text: string) {
  let s = String(text || "");

  s = s.replace(/\r/g, "\n");

  s = s.replace(/안녕하세요\.?|안녕하십니까\.?/g, " ");
  s = s.replace(
    /(부탁드려요|부탁드립니다|부탁드리겠습니다|드리겠습니다|부탁해요|주세요|주문합니다|주문드려요|주문드립니다|발주\s*요청|발주\s*부탁)\.?/g,
    " "
  );
  s = s.replace(/(감사합니다|고맙습니다)\.?/g, " ");

  s = s.replace(/,\s*(?=\d{3,4}\/)/g, "\n");
  s = s.replace(/,\s*(?=[가-힣]{2})/g, "\n");

  s = s.replace(/[.!?]/g, "\n");

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

function pickBrandToken(input: string) {
  const stop = new Set(["주식회사", "스시", "점", "지점", "본점"]);
  const toks = extractKoreanTokens(input)
    .map((t) => t.replace(/(지점|점|본점)$/g, ""))
    .filter((t) => t.length >= 2 && !stop.has(t));

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

  const nameAlias = nRaw.match(/\(([^)]+)\)/);
  if (nameAlias) {
    const aliasText = nameAlias[1].trim();
    const aliasNorm = norm(aliasText);

    if (a === aliasNorm) return 1.0;

    if (aliasNorm.includes(a) || a.includes(aliasNorm)) {
      return 0.98;
    }

    const aChars = new Set(a.split(""));
    const aliasChars = new Set(aliasNorm.split(""));
    let common = 0;
    for (const ch of aChars) {
      if (aliasChars.has(ch)) common++;
    }
    const similarity = common / Math.max(a.length, aliasNorm.length);

    if (similarity >= 0.7) {
      const lenDiff = Math.abs(a.length - aliasNorm.length);
      const lenPenalty = lenDiff * 0.02;
      const score = Math.max(0.85, Math.min(0.97, 0.95 - lenPenalty));
      return score;
    }
  }

  const brand = pickBrandToken(qRaw);
  if (brand) {
    const brandNorm = norm(brand);

    const nameMainText = nRaw.replace(/\([^)]+\)/g, "").trim();
    const nameAliasText = nameAlias ? nameAlias[1].trim() : "";

    const nameMainNorm = norm(nameMainText);
    const nameAliasNorm = norm(nameAliasText);

    if (brandNorm && !b.includes(brandNorm) && !nameMainNorm.includes(brandNorm) && !nameAliasNorm.includes(brandNorm)) {
      return 0.45;
    }
  }

  const extractBranchTokens = (s: string) =>
    extractKoreanTokens(s)
      .map((t) => t.replace(/(지점|점|본점)$/g, ""))
      .filter(Boolean);

  const stop2 = new Set(["주식회사", brand]);
  const qTokens = extractBranchTokens(qRaw).filter((t) => !stop2.has(t));
  const nTokens = extractBranchTokens(nRaw).filter((t) => !stop2.has(t));

  let branchAdj = 0;
  if (qTokens.length > 0) {
    const hasAny = qTokens.some((t) => nTokens.includes(t));
    if (hasAny) branchAdj += 0.18;

    const hasMismatch = nTokens.some((t) => !qTokens.includes(t));
    if (!hasAny && hasMismatch) branchAdj -= 0.25;
  }

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
// ✅ 한국 공휴일: app/lib/holidays.ts (공공데이터 API + Supabase 캐시)

function isSundayKST(d: Date) {
  const kst = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  return kst.getDay() === 0;
}

async function getDeliveryDateKST(now = new Date()) {
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

  // ✅ 공휴일/일요일이면 다음날로 미룸 (토요일은 허용)
  while (isSundayKST(delivery) || await isHolidayKST(delivery)) {
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
async function resolveClient({
  clientText,
  message,
  forceResolve,
}: {
  clientText: string;
  message: string;
  forceResolve: boolean;
}) {
  const { data: rowsData } = await supabase
    .from('glass_client_alias')
    .select('client_code, alias, weight');
  const rows = (rowsData || []) as Array<{ client_code: any; alias: any; weight?: any }>;

  const candidate = String(clientText || "").trim() || firstLine(message);

  // 1순위: 거래처 코드 직접 매칭
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

    // alias에 없으면 glass_clients 테이블에서 직접 검색
    const { data: directClient } = await supabase
      .from('glass_clients')
      .select('client_code, client_name')
      .eq('client_code', candidate)
      .maybeSingle();

    if (directClient) {
      return {
        status: "resolved",
        client_code: String(directClient.client_code),
        client_name: String(directClient.client_name),
        method: "exact_code_direct",
      };
    }
  }

  // 2순위: 거래처명 exact 매칭
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

    let bonus = Math.min(0.2, Math.max(0, (w - 1) * 0.02));

    if (base <= 0.5) bonus = 0;

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
  return /(\d|병|박스|cs|box|bt|btl)/i.test(line);
}

function splitClientAndOrder(body: any) {
  const message = body?.message ?? "";
  const clientText = body?.clientText ?? "";
  const orderText = body?.orderText ?? "";

  if (clientText || orderText) {
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

  if (lines.length <= 1) {
    return { rawMessage: msg, clientText: "", orderText: msg };
  }

  if (isLikelyOrderLine(first)) {
    return { rawMessage: msg, clientText: "", orderText: msg };
  }

  return { rawMessage: msg, clientText: first, orderText: rest };
}

// Glass 품목 단위 결정 함수
function getGlassUnit(itemName: string): string {
  if (/디캔터|박스|쇼핑백|클리너|캐링백|세트|밸류팩|폴리싱|클로스|린넨|보틀\s*클리너/i.test(itemName)) {
    return "개";
  }

  const rdMatch = itemName.match(/RD\s+(\d{4}\/\d{1,3}(?:[A-Z][A-Z0-9]*)?)/i);
  if (rdMatch) {
    return "잔";
  }

  if (/레스토랑/i.test(itemName)) {
    return "잔";
  }

  const codeOnly = itemName.match(/^0?\d{3,4}\/\d{1,3}(?:[A-Z][A-Z0-9]*)?$/i);
  if (codeOnly) {
    return "잔";
  }

  return "개";
}

async function formatStaffMessage(
  client: any,
  items: any[],
  options?: {
    customDeliveryDate?: string;
    requirePaymentConfirm?: boolean;
    requireInvoice?: boolean;
  }
) {
  const delivery = await getDeliveryDateKST();
  const deliveryLabel = options?.customDeliveryDate || delivery.label;

  const lines: string[] = [];
  lines.push(
    `거래처: ${client.client_name} (${cleanClientCode(client.client_code)})`
  );
  lines.push(`배송 예정일: ${deliveryLabel}`);

  if ((client as any).phone) {
    lines.push(`연락처: ${(client as any).phone}`);
  }
  if ((client as any).email) {
    lines.push(`세금계산서: ${(client as any).email}`);
  }

  lines.push("");

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
  // 엑셀 자동 동기화 (파일 변경 시에만 실행)
  const sync = await syncFromXlsxIfNeeded();
  const glassSync = await syncGlassFromXlsxIfNeeded();
  console.log("[XLSX SYNC]", sync, "[GLASS SYNC]", glassSync);

  try {
    const body = await req.json().catch(() => ({}));
    const forceResolve = Boolean(body?.force_resolve);

    // 신규 사업자 처리
    const newBusiness = body?.newBusiness;
    if (newBusiness && newBusiness.name && newBusiness.phone) {
      console.log("[NEW BUSINESS]", newBusiness);

      const pre0 = preprocessGlassMessage(body?.message ?? "");
      const trMsg = await translateOrderToKoreanIfNeeded(pre0);
      const preMessage = trMsg.translated ? trMsg.text : pre0;
      const parsedItems = parseGlassItemsFromMessage(preMessage);

      const client = {
        status: "resolved" as const,
        client_name: newBusiness.name,
        client_code: "NEW",
        phone: newBusiness.phone,
        email: newBusiness.email,
      };

      const resolvedItems = await resolveGlassItemsByClient("NEW", parsedItems, {
        minScore: 0.55,
        minGap: 0.05,
        topN: 5,
      });

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
      const staffMessage = await formatStaffMessage(
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

    // 0) 전체 메시지 전처리 먼저
    const pre0 = preprocessGlassMessage(body?.message ?? "");

    // 0-1) 번역(영어 비중 높을 때만)
    const trMsg = await translateOrderToKoreanIfNeeded(pre0);
    const preMessage = trMsg.translated ? trMsg.text : pre0;

    // 전처리된 message로 split 수행
    const { rawMessage, clientText, orderText } = splitClientAndOrder({
      ...body,
      message: preMessage,
    });

    // 1) 거래처 resolve
    const client = await resolveClient({
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

    // 2-0) 거래처명이 품목 텍스트에 섞여있으면 제거
    if (client.status === "resolved" && client.client_name) {
      const clientName = String((client as any).client_name || "");
      if (clientName) {
        order0 = order0
          .split("\n")
          .map((line) => {
            const trimmed = line.trim();
            if (trimmed.startsWith(clientName)) {
              const rest = trimmed.slice(clientName.length).trim();
              return rest || "";
            }
            if (norm(trimmed) === norm(clientName)) {
              return "";
            }
            const clientNorm = norm(clientName);
            const lineTokens = trimmed.split(/\s+/);
            if (lineTokens.length > 1) {
              if (lineTokens.length > 2) {
                const twoTokens = lineTokens.slice(0, 2).join(" ");
                const twoTokenNorm = norm(twoTokens);
                if (twoTokenNorm === clientNorm || clientNorm.includes(twoTokenNorm) || twoTokenNorm.includes(clientNorm)) {
                  return lineTokens.slice(2).join(" ");
                }
              }
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

    // 2-1) 번역(영어 비중 높을 때만)
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
    const resolvedItems = await resolveGlassItemsByClient(clientCode, parsedItems, {
      minScore: 0.55,
      minGap: 0.05,
      topN: 5,
    });

    // 3-1) unresolved인 품목에 후보 3개(suggestions) 붙이기 (UI용)
    const itemsWithSuggestions = resolvedItems.map((x: any) => {
      if (x?.resolved) return x;

      const suggestions = Array.isArray(x?.suggestions)
        ? x.suggestions
        : Array.isArray(x?.candidates)
          ? x.candidates.slice(0, 3)
          : [];

      return {
        ...x,
        suggestions,
      };
    });

    // 4) 상태 결정
    const hasUnresolved = itemsWithSuggestions.some((x: any) => !x.resolved);

    return jsonResponse({
      success: true,
      status: hasUnresolved ? "needs_review_items" : "resolved",
      client,
      parsed_items: parsedItems,

      items: itemsWithSuggestions,

      staff_message: await formatStaffMessage(client, itemsWithSuggestions, {
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
