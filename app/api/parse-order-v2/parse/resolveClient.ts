import { supabase } from "@/app/lib/db";
import { norm, firstLine, scoreName } from "./utils";

/**
 * client_alias 기반 거래처 resolve.
 *  1) 숫자 5자리 직접 코드
 *  2) norm exact
 *  3) fuzzy + weight 보너스 (top score >= 0.90 + gap 0.08)
 *  4) forceResolve: top >= 0.45 + gap 0.15
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
  const candidate = String(clientText || "").trim() || firstLine(message);

  // 1) 5자리 숫자 코드 직접
  if (candidate && /^\d{5}$/.test(candidate)) {
    const { data: directClient } = await supabase
      .from("clients")
      .select("client_code, client_name")
      .eq("client_code", candidate)
      .maybeSingle();

    if (directClient) {
      return {
        status: "resolved",
        client_code: String(directClient.client_code),
        client_name: String(directClient.client_name),
        method: "exact_code",
      };
    }
  }

  const { data: aliasRows } = await supabase
    .from("client_alias")
    .select("client_code, alias, weight");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (aliasRows || []) as Array<{ client_code: any; alias: any; weight?: any }>;

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
  const q = candidate || message || "";
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

  const canAuto = top && top.score >= 0.90 && (!second || top.score - second.score >= 0.08);
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
