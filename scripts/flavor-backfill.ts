// 향미 백필: 재고≥10 + 테이스팅노트 있는 와인의 상세 향미를 Sonnet+웹검색으로 조사 →
// 세분화 태그(flavor.ts V2) 추출 → tasting_notes.flavor_tags 저장. 표시용 노트는 건드리지 않음.
//   npx tsx scripts/flavor-backfill.ts --list 10     # 다음 10건 목록만
//   npx tsx scripts/flavor-backfill.ts --run 10      # 다음 10건 조사+저장
import { config } from 'dotenv'; config({ path: '.env.local', quiet: true });

/* eslint-disable @typescript-eslint/no-explicit-any */
async function main() {
  const { supabase } = await import('@/app/lib/db');
  const { getClaudeClient } = await import('@/app/lib/claudeClient');
  const { extractFlavorKeys, flavorLabel } = await import('@/app/api/sales/recommend/lib/flavor');
  const { isNonOrderable } = await import('@/app/lib/catalogFilter');
  const { isGiftBox, isNonStandardBottle } = await import('@/app/api/sales/recommend/lib/bottleSize');

  const argv = process.argv.slice(2);
  const mode = argv.includes('--run') ? 'run' : 'list';
  const nIdx = Math.max(argv.indexOf('--run'), argv.indexOf('--list'));
  const N = Number(argv[nIdx + 1]) || 10;

  // 1) 재고 ≥10 재고맵 + 출고량
  const inv = (await supabase.from('inventory_cdv').select('item_no, item_name').gte('available_stock', 10)).data as any[] || [];
  const invMap = new Map(inv.map(x => [x.item_no, x]));
  const ship = (await supabase.from('shipments').select('item_no, quantity').gt('selling_price', 0)).data as any[] || [];
  const qty: Record<string, number> = {};
  for (const s of ship) if (invMap.has(s.item_no)) qty[s.item_no] = (qty[s.item_no] || 0) + (Number(s.quantity) || 0);

  // 2) 노트 있는 것 + 아직 향미조사 안 한 것
  const codes = [...invMap.keys()];
  type Row = { wine_id: string; nose_note?: string; palate_note?: string; flavor_research_at?: string };
  const notes: Row[] = [];
  for (let i = 0; i < codes.length; i += 200) {
    const d = (await supabase.from('tasting_notes').select('wine_id, nose_note, palate_note, flavor_research_at').in('wine_id', codes.slice(i, i + 200))).data as Row[] || [];
    notes.push(...d);
  }
  const hasNote = (r: Row) => (r.nose_note || '').trim() || (r.palate_note || '').trim();
  const isWine = (code: string) => {
    const w = invMap.get(code); if (!w) return false;
    return !isNonOrderable(w.item_no, w.item_name, 'CDV') && !isGiftBox(w.item_name) && !isNonStandardBottle(w.item_name);
  };
  const targetsAll = notes.filter(r => hasNote(r) && isWine(r.wine_id)).map(r => r.wine_id);
  const done = new Set(notes.filter(r => r.flavor_research_at).map(r => r.wine_id));
  const pending = targetsAll.filter(c => !done.has(c)).sort((a, b) => (qty[b] || 0) - (qty[a] || 0));

  console.log(`총 조사대상(재고≥10·노트있음·와인): ${targetsAll.length}종 · 완료 ${done.size} · 남음 ${pending.length}`);
  const batch = pending.slice(0, N);
  console.log(`\n이번 ${mode === 'run' ? '조사' : '목록'} 대상 ${batch.length}종 (출고순):`);
  const wineOf = new Map<string, any>();
  for (let i = 0; i < codes.length; i += 200) {
    const w = (await supabase.from('wines').select('item_code, item_name_kr, item_name_en, grape_varieties, region, country').in('item_code', batch)).data as any[] || [];
    for (const x of w) wineOf.set(x.item_code, x);
    if (wineOf.size >= batch.length) break;
  }
  batch.forEach((c, i) => {
    const w = wineOf.get(c) || {};
    console.log(`  ${String(i + 1).padStart(2)}. ${(w.item_name_kr || c).slice(0, 28).padEnd(28)} 출고 ${(qty[c] || 0)}병 · ${w.grape_varieties || '-'}`);
  });

  if (mode === 'list') { console.log('\n(목록만. 조사하려면 --run)'); process.exit(0); }

  // 3) 조사 + 저장
  const client = getClaudeClient();
  let ok = 0, totalIn = 0, totalOut = 0;
  for (const c of batch) {
    const w = wineOf.get(c) || invMap.get(c) || {};
    const name = w.item_name_en || w.item_name_kr || c;
    try {
      const res = await client.messages.create({
        model: 'claude-sonnet-4-6', max_tokens: 900,
        tools: [{ type: 'web_search_20250305' as const, name: 'web_search', max_uses: 2 }],
        messages: [{ role: 'user', content: `Find DETAILED tasting notes for this specific wine (search Vivino/Wine-Searcher/critic reviews).
Wine: ${name} (${w.grape_varieties || ''}, ${w.region || ''} ${w.country || ''})
Return ONLY JSON: {"nose":"detailed aroma descriptors","palate":"detailed palate descriptors"}. Use SPECIFIC descriptors (lemon zest, wet stone, flint, vanilla, toast, blackcurrant, violet, leather, brioche...), not generic terms.` }],
      });
      totalIn += res.usage?.input_tokens || 0; totalOut += res.usage?.output_tokens || 0;
      const txt = res.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('').replace(/<cite[^>]*>.*?<\/cite>/g, '');
      let nn = '', pp = ''; try { const j = JSON.parse((txt.match(/\{[\s\S]*\}/) || [txt])[0]); nn = j.nose || ''; pp = j.palate || ''; } catch {}
      const tags = [...extractFlavorKeys(`${nn} ${pp}`)];
      await supabase.from('tasting_notes').update({ flavor_tags: tags, flavor_research_at: new Date().toISOString() }).eq('wine_id', c);
      ok++;
      console.log(`  ✅ ${(w.item_name_kr || c).slice(0, 24)} → ${tags.length}개: ${tags.map(flavorLabel).join('·')}`);
    } catch (e: any) {
      console.log(`  ❌ ${(w.item_name_kr || c).slice(0, 24)} — ${e.message}`);
    }
  }
  const cost = totalIn * 3 / 1e6 + totalOut * 15 / 1e6;
  console.log(`\n완료 ${ok}/${batch.length} · 비용 ~$${cost.toFixed(3)} · 남은 대상 ${pending.length - ok}종`);
  process.exit(0);
}
main().catch(e => { console.error('FAIL', e.message); process.exit(1); });
