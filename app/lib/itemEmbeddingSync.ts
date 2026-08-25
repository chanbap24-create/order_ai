// 재고(inventory) → item_embeddings 동기화 (Phase 2a).
// 변경/신규 품목만 임베딩, 재고에서 사라진 품목 임베딩은 삭제.
// 재고 업로드 후 호출(또는 /api/admin/embeddings/sync 로 수동 백필).

import { supabase } from "@/app/lib/db";
import { fetchAllRows } from "@/app/lib/fetchAll";
import { logger } from "@/app/lib/logger";
import { buildItemContent, embedTexts } from "@/app/lib/embeddings";

const INV_TABLE = { CDV: "inventory_cdv", DL: "inventory_dl" } as const;

type Tab = "CDV" | "DL";
interface InvItem { item_no: string; item_name: string; country: string | null }

/** vector 컬럼용 문자열 포맷 ('[0.1,0.2,...]') */
function toVectorLiteral(emb: number[]): string {
  return `[${emb.join(",")}]`;
}

export interface SyncResult { tab: Tab; total: number; embedded: number; deleted: number }

export async function syncItemEmbeddings(tab: Tab): Promise<SyncResult> {
  const invTable = INV_TABLE[tab];

  // 1. 재고 전체 (item_no/품명/국가) — 1000행 캡 페이지네이션.
  // ⚠️ 잘린 목록 기준으로 아래 stale 삭제가 돌면 정상 품목의 임베딩을 지우게 되므로 필수.
  const inv = await fetchAllRows<InvItem>((f, t) => supabase
    .from(invTable)
    .select("item_no, item_name, country")
    .not("item_no", "is", null)
    .order("item_no")
    .range(f, t));

  // 2. 기존 임베딩 content (변경 감지용)
  const existRows = await fetchAllRows<{ item_no: string; content: string }>((f, t) => supabase
    .from("item_embeddings")
    .select("item_no, content")
    .eq("tab", tab)
    .order("item_no")
    .range(f, t));
  const existing = new Map<string, string>();
  for (const r of existRows) {
    existing.set(r.item_no, r.content);
  }

  // 3. content 계산 + 변경분만 추출
  const targets = inv.map((it) => ({
    item_no: it.item_no,
    item_name: it.item_name || "",
    content: buildItemContent(it.item_name, it.country),
  }));
  const changed = targets.filter((t) => existing.get(t.item_no) !== t.content);

  // 4. 임베딩 + upsert (배치)
  let embedded = 0;
  for (let i = 0; i < changed.length; i += 256) {
    const batch = changed.slice(i, i + 256);
    const vectors = await embedTexts(batch.map((b) => b.content));
    const rows = batch.map((b, j) => ({
      tab,
      item_no: b.item_no,
      item_name: b.item_name,
      content: b.content,
      embedding: toVectorLiteral(vectors[j]),
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from("item_embeddings").upsert(rows, { onConflict: "tab,item_no" });
    if (error) throw new Error(`embedding upsert failed: ${error.message}`);
    embedded += rows.length;
  }

  // 5. 재고에서 사라진 임베딩 삭제
  const invSet = new Set(inv.map((it) => it.item_no));
  const stale = [...existing.keys()].filter((no) => !invSet.has(no));
  let deleted = 0;
  if (stale.length > 0) {
    for (let i = 0; i < stale.length; i += 200) {
      const chunk = stale.slice(i, i + 200);
      await supabase.from("item_embeddings").delete().eq("tab", tab).in("item_no", chunk);
      deleted += chunk.length;
    }
  }

  logger.info(`[Embeddings] sync ${tab}: total=${inv.length} embedded=${embedded} deleted=${deleted}`);
  return { tab, total: inv.length, embedded, deleted };
}
