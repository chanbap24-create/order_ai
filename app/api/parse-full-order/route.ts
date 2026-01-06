import { NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { parseItemsFromMessage } from "@/app/lib/parseItems";
import { resolveItemsByClient } from "@/app/lib/resolveItems";
import { syncFromXlsxIfNeeded } from "@/app/lib/syncFromXlsx";
import { translateOrderToKoreanIfNeeded } from "@/app/lib/translateOrder";


import Holidays from "date-holidays";

export const runtime = "nodejs";

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
  s = s.replace(/\s*,\s*/g, "\n"); // 콤마도 혹시 몰라 처리

  // ✅ 주문 가능 문구/요청문 제거 (숫자 뒤에 붙어서 수량 인식 방해)
  s = s.replace(
    /(발주\s*가능할까요|가능할까요|가능한가요|발주\s*가능)\??/g,
    " "
  );

  // 문장부호 -> 줄바꿈(문장형 주문을 라인형으로)
  s = s.replace(/[.!?]/g, "\n");

  // ✅ 핵심: "샤도3", "부르고뉴샤도6" 같은 케이스 처리
  // (한글/영문) + 숫자
  s = s.replace(/([가-힣A-Za-z])(\d+)/g, "$1 $2");
  // 숫자 + (한글/영문)
  s = s.replace(/(\d+)([가-힣A-Za-z])/g, "$1 $2");

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
  const brand = pickBrandToken(qRaw); // 예: "스시소라" or "라뜨리에드"
  if (brand) {
    const brandNorm = norm(brand);
    
    // ✅ 괄호 안의 별칭도 검색 대상에 포함
    const nameMainText = nRaw.replace(/\([^)]+\)/g, "").trim();
    const nameAliasText = nameAlias ? nameAlias[1].trim() : "";
    
    const nameMainNorm = norm(nameMainText);
    const nameAliasNorm = norm(nameAliasText);
    
    // 브랜드가 메인 텍스트나 괄호 안 별칭 어디에도 없으면 점수 제한
    if (brandNorm && !b.includes(brandNorm) && !nameMainNorm.includes(brandNorm) && !nameAliasNorm.includes(brandNorm)) {
      // 브랜드가 없으면 점수 상한을 낮게 캡 (지점만 맞아도 상위 못 오게)
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
  
  // ✅ 발주 옵션 (배송일 바로 밑에 표기)
  if (options?.requirePaymentConfirm) {
    lines.push("입금확인후 출고");
  }
  if (options?.requireInvoice) {
    lines.push("거래명세표 부탁드립니다");
  }
  
  lines.push("");
  lines.push("품목:");

  for (const it of items) {
    if (it.resolved) {
      lines.push(`- ${it.item_no} / ${it.item_name} / ${it.qty}병`);
    } else {
      lines.push(`- 확인필요 / "${it.name}" / ${it.qty}병`);
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
    const order0 = preprocessMessage(orderText || rawMessage);

    // ✅ 2-1) 번역(영어 비중 높을 때만)
    const trOrder = await translateOrderToKoreanIfNeeded(order0);
    const orderPre = trOrder.translated ? trOrder.text : order0;

    const parsedItems = parseItemsFromMessage(orderPre);

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
    const resolvedItems = resolveItemsByClient(clientCode, parsedItems, {
      minScore: 0.55,
      minGap: 0.05,
      topN: 5,
    });

    // ✅ 3-1) unresolved인 품목에 후보 3개(suggestions) 붙이기 (UI용)
    //     - 새로 DB에서 찾지 말고, resolveItemsByClient가 만든 candidates를 그대로 사용
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
    return NextResponse.json(
      { success: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
