import { supabase } from "@/app/lib/db";
import { norm, firstLine, scoreName } from "./utils";

/**
 * glass_client_alias 기반 거래처 resolve.
 *  1) 숫자 코드 매칭 (alias + glass_clients 직접)
 *  2) exact norm
 *  3) fuzzy + weight 보너스 (>=0.93 auto, force >=0.45)
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
    .from('glass_client_alias')
    .select('client_code, alias, weight');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (rowsData || []) as Array<{ client_code: any; alias: any; weight?: any }>;

  const candidate = String(clientText || "").trim() || firstLine(message);

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
