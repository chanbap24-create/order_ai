import { supabase } from "@/app/lib/db";
import { norm, firstLine, scoreName } from "./utils";
import { extractDeliveryDestination } from "@/app/lib/orderDestination";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AliasRow = { client_code: any; alias: any; weight?: any };

/**
 * glass_client_alias 기반 거래처 resolve.
 *  - 본문에 명시한 배송지("매쎄로 발주")가 거래처로 "확실히"(코드/exact/fuzzy auto) 매칭되면
 *    발신자명·첫줄보다 우선한다. 확실치 않으면 무시 → 품목 오탐("올드월드 쉬라로")이
 *    정상 거래처를 덮어쓰지 않는다.
 *  1) 숫자 코드  2) exact norm  3) fuzzy (>=0.93 auto, force >=0.45)
 */
export async function resolveClient({
  clientText,
  message,
  forceResolve,
}: {
  clientText: string;
  message: string;
  forceResolve: boolean;
}) {
  const { data: rowsData } = await supabase
    .from("glass_client_alias")
    .select("client_code, alias, weight");
  const rows = (rowsData || []) as AliasRow[];

  const primary = String(clientText || "").trim() || firstLine(message);
  const dest = extractDeliveryDestination(message);

  // 배송지 우선: 거래처로 확실히 매칭될 때만 채택(force 미적용 → 약한 추정은 무시)
  if (dest && dest !== primary) {
    const r = await resolveOne(dest, rows, false);
    if (r.status === "resolved") return { ...r, method: `dest_${r.method}` };
  }

  return resolveOne(primary, rows, forceResolve);
}

/** 단일 후보 문자열을 거래처로 해석 (코드 → exact norm → fuzzy) */
async function resolveOne(candidate: string, rows: AliasRow[], forceResolve: boolean) {
  // 1) 숫자 코드 직접
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

    const { data: directClient } = await supabase
      .from("glass_clients")
      .select("client_code, client_name")
      .eq("client_code", candidate)
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

  // 2) exact norm
  if (candidate) {
    const exact = rows.find(
      (r) => norm(r.alias) && norm(r.alias) === norm(candidate),
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

  // 3) fuzzy
  const q = candidate || "";
  const scored = rows
    .map((r) => {
      const base = scoreName(q, r.alias);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  const canAuto = top && top.score >= 0.93 && (!second || top.score - second.score >= 0.08);
  if (canAuto) return { status: "resolved", ...top, method: "fuzzy_auto" };

  const forceOk = Boolean(forceResolve)
    && top && top.score >= 0.45
    && (!second || top.score - second.score >= 0.15);
  if (forceOk) return { status: "resolved", ...top, method: "fuzzy_force" };

  return {
    status: "needs_review_client",
    score: top?.score ?? 0,
    candidates: scored,
    hint_used: candidate,
  };
}
