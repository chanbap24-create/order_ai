import { supabase } from "@/app/lib/db";
import { firstLine, norm, scoreName } from "./utils";

type ClientResolveArgs = {
  clientText: string;
  message: string;
  forceResolve: boolean;
};

export async function resolveClient({
  clientText,
  message,
  forceResolve,
}: ClientResolveArgs) {
  const candidate = String(clientText || "").trim() || firstLine(message);

  // 1) 거래처 코드 직접 입력 (숫자 5자리)
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

  const rows = (aliasRows || []) as Array<{ client_code: any; alias: any; weight?: any }>;

  // 2) exact(norm) 매칭
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

  // fuzzy
  const q = candidate || message || "";
  const scored = rows
    .map((r) => {
      const base = scoreName(q, r.alias);
      const w = Number((r as any).weight ?? 1);

      // weight 보너스
      let bonus = Math.min(0.2, Math.max(0, (w - 1) * 0.02));
      // base가 낮으면(weight로 역전 방지)
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
