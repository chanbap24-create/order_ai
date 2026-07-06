// 거래처정보 업로드 처리 — ERP 명부를 세일즈 거래처 마스터에 반영(authoritative).
//  - 와인(CDV): client_details (client_type='wine')
//  - 글라스(DL): glass_clients  (CDV/DL 코드공간 독립 — client_details 절대 안 건드림)
// 매핑 필드만 덮어씀(name·business_type·manager·contact_name·address). importance·memo·tags·
// contact_phone·contact_email 등 나머지는 payload에 없어 그대로 보존(사용자 편집값 유지).
// '잠금 없음' 정책: 거래명세표 자동갱신 흐름은 그대로. 가끔 이 파일을 올려 최종값으로 재설정.
import { supabase } from "@/app/lib/db";
import { logger } from "@/app/lib/logger";

export interface ClientInfoRow {
  client_code: string;
  client_name: string;
  business_type: string;
  manager: string;
  contact_name: string;
  address: string;
}

const nz = (s: string): string | null => (s && s.trim() ? s.trim() : null);

export async function processClientInfoFromData(
  rows: ClientInfoRow[],
  isGlass: boolean,
): Promise<{ updated: number }> {
  // 코드 중복 제거(마지막 행 우선)
  const byCode = new Map<string, ClientInfoRow>();
  for (const r of rows || []) {
    const code = (r.client_code || "").trim();
    if (code) byCode.set(code, r);
  }
  const arr = [...byCode.values()];
  if (arr.length === 0) return { updated: 0 };

  const table = isGlass ? "glass_clients" : "client_details";
  const now = new Date().toISOString();
  let updated = 0;
  for (let i = 0; i < arr.length; i += 300) {
    const batch = arr.slice(i, i + 300).map((r) => {
      const base: Record<string, unknown> = {
        client_code: r.client_code.trim(),
        client_name: (r.client_name || "").trim(),
        business_type: nz(r.business_type),
        manager: nz(r.manager),
        contact_name: nz(r.contact_name),
        address: nz(r.address),
        status: nz(r.status),
        updated_at: now,
      };
      if (!isGlass) base.client_type = "wine";
      return base;
    });
    const { error } = await supabase.from(table).upsert(batch, { onConflict: "client_code" });
    if (error) {
      logger.error(`[ClientInfo] ${table} upsert error at batch ${i}`, { error });
      throw new Error(`${table} 업데이트 실패: ${error.message}`);
    }
    updated += batch.length;
  }
  logger.info(`[ClientInfo] ${table} 업데이트 ${updated}곳 (isGlass=${isGlass})`);
  return { updated };
}
