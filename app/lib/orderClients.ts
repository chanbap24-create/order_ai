// 담당자(manager)별 거래처 목록 — 발주 스크린샷 LLM 거래처 선택 / 검색 스코프용.
// 와인(CDV)=client_details.manager, 글라스(DL)=glass_shipments.manager 기준.
import { supabase } from "@/app/lib/db";

export interface MgrClient {
  client_code: string;
  client_name: string;
  aliases: string[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

/** "/ 사업자변경" 등 안 쓰는(이전) 사업자 표기 — 발주 거래처 선택에서 제외. */
function isUnusedClient(name: string): boolean {
  return name.replace(/\s/g, "").includes("사업자변경");
}

/** 담당자의 거래처 목록(별칭 최대 3개 포함). manager 없으면 빈 배열. */
export async function getManagerClients(manager: string, tab: string): Promise<MgrClient[]> {
  if (!manager?.trim()) return [];
  const isGlass = tab === "DL";

  // 1) 거래처 코드·이름 — DISTINCT RPC로 담당자 전체 거래처를 정확히 조회(원행 limit 누락 방지)
  const byCode = new Map<string, string>(); // code → name
  const { data } = await supabase.rpc("manager_clients", { p_manager: manager, p_glass: isGlass });
  for (const r of (data || []) as Row[]) {
    const code = String(r.client_code || "").trim();
    const name = String(r.client_name || code).trim();
    if (code && name && !isUnusedClient(name) && !byCode.has(code)) byCode.set(code, name);
  }
  if (byCode.size === 0) return [];

  // 2) 별칭 보강(있으면 LLM 매칭 힌트로 유용)
  const aliasMap = new Map<string, string[]>();
  const codes = [...byCode.keys()];
  const aliasTable = isGlass ? "glass_client_alias" : "client_alias";
  for (let i = 0; i < codes.length; i += 300) {
    const { data } = await supabase
      .from(aliasTable)
      .select("client_code, alias")
      .in("client_code", codes.slice(i, i + 300));
    for (const r of (data || []) as Row[]) {
      const code = String(r.client_code || "");
      const alias = String(r.alias || "").trim();
      if (!code || !alias) continue;
      const arr = aliasMap.get(code) || [];
      if (arr.length < 3 && !arr.includes(alias)) arr.push(alias);
      aliasMap.set(code, arr);
    }
  }

  return codes.map((code) => ({
    client_code: code,
    client_name: byCode.get(code) || code,
    aliases: aliasMap.get(code) || [],
  }));
}

/** 담당자 거래처 코드 집합만(별칭 미조회 — 검색 스코프용 경량). */
export async function getManagerClientCodes(manager: string, tab: string): Promise<Set<string>> {
  const set = new Set<string>();
  if (!manager?.trim()) return set;
  // DISTINCT RPC로 담당자 전체 거래처 코드를 정확히 조회(원행 limit 누락 방지)
  const { data } = await supabase.rpc("manager_clients", { p_manager: manager, p_glass: tab === "DL" });
  for (const r of (data || []) as Row[]) if (r.client_code) set.add(String(r.client_code));
  return set;
}
