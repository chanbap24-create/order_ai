// 매처 v3 — 와인 카탈로그 임베딩 인덱스 구축 (wine_embeddings)
// 사용: npx tsx --env-file=.env.local scripts/build-wine-embeddings.ts [--force]
// 문서 = 품명(한글) + 영문명 + 브랜드/생산자 + 국가. doc이 바뀐 품목만 재임베딩(증분).
import { readFileSync } from 'fs';
import { toJamo } from '../app/lib/matcher-v3/jamo';
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
}

const EMBED_MODEL = 'text-embedding-3-small';
const BATCH = 256;

async function embedBatch(inputs: string[]): Promise<number[][]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: EMBED_MODEL, input: inputs }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  return j.data.map((d: { embedding: number[] }) => d.embedding);
}

async function main() {
  const force = process.argv.includes('--force');
  const { supabase } = await import('../app/lib/db');
  const { fetchAllRows } = await import('../app/lib/fetchAll');

  // 카탈로그: CDV 재고표의 "와인 분류"만 (품번 첫자리 0~5, A) — 글라스·자재·세트·백화점(ZK) 제외.
  // 글라스(리델 RD)·유리병 같은 비와인이 섞이면 임베딩 검색이 오염된다(v3 테스트에서 확인).
  const WINE_PREFIX = new Set(['0', '1', '2', '3', '4', '5', 'A']);
  const invAll = await fetchAllRows<{ item_no: string; item_name: string; brand: string | null; country: string | null }>(
    (f, t) => supabase.from('inventory_cdv').select('item_no, item_name, brand, country').not('item_no', 'ilike', 'zk%').range(f, t));
  const inv = invAll.filter((r) => WINE_PREFIX.has(String(r.item_no || '').charAt(0).toUpperCase()));
  const wines = await fetchAllRows<{ item_code: string; item_name_en: string | null; brand: string | null }>(
    (f, t) => supabase.from('wines').select('item_code, item_name_en, brand').range(f, t));
  const wineMap = new Map(wines.map((w) => [w.item_code, w]));

  const docs = inv
    .filter((r) => r.item_no && r.item_name)
    .map((r) => {
      const w = wineMap.get(r.item_no);
      const parts = [r.item_name, w?.item_name_en, r.brand || w?.brand, r.country];
      return { item_no: String(r.item_no), item_name: r.item_name, doc: parts.filter(Boolean).join(' | ') };
    });
  console.log(`카탈로그 ${docs.length}품목`);

  // 증분: 기존 doc과 같으면 스킵
  const existing = force ? [] : await fetchAllRows<{ item_no: string; doc: string }>(
    (f, t) => supabase.from('wine_embeddings').select('item_no, doc').range(f, t));
  const existingMap = new Map(existing.map((e) => [e.item_no, e.doc]));
  const targets = docs.filter((d) => existingMap.get(d.item_no) !== d.doc);
  console.log(`임베딩 대상 ${targets.length}건 (스킵 ${docs.length - targets.length})`);

  for (let i = 0; i < targets.length; i += BATCH) {
    const chunk = targets.slice(i, i + BATCH);
    const vecs = await embedBatch(chunk.map((c) => c.doc));
    const rows = chunk.map((c, j) => ({ ...c, jamo: toJamo(c.item_name), embedding: JSON.stringify(vecs[j]), updated_at: new Date().toISOString() }));
    const { error } = await supabase.from('wine_embeddings').upsert(rows, { onConflict: 'item_no' });
    if (error) throw new Error(error.message);
    console.log(`  ${Math.min(i + BATCH, targets.length)}/${targets.length}`);
  }
  console.log('완료');
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
