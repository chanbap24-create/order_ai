// 향미태그 브라우저용 데이터: 조사된 와인(flavor_tags 있음) + 메타 + 한글 향미 라벨.
import { supabase } from '@/app/lib/db';
import { flavorLabel } from '@/app/api/sales/recommend/lib/flavor';

export type FlavorWine = {
  code: string;
  name: string;
  type: string;
  country: string;
  price: number;
  tags: string[]; // 한글 향미 라벨
};

/** flavor_tags 있는 와인 전체를 이름순으로. 향미 키는 한글 라벨로 변환. */
export async function getFlavorTagsData(): Promise<FlavorWine[]> {
  const notes = (await supabase
    .from('tasting_notes')
    .select('wine_id, flavor_tags')
    .not('flavor_tags', 'is', null)).data as Array<{ wine_id: string; flavor_tags: string[] | null }> || [];
  const withTags = notes.filter((n) => n.flavor_tags && n.flavor_tags.length);
  const codes = withTags.map((n) => n.wine_id);

  const wmap = new Map<string, { item_name_kr?: string; wine_type?: string; country?: string; supply_price?: number }>();
  for (let i = 0; i < codes.length; i += 300) {
    const w = (await supabase
      .from('wines')
      .select('item_code, item_name_kr, wine_type, country, supply_price')
      .in('item_code', codes.slice(i, i + 300))).data as Array<{ item_code: string } & Record<string, unknown>> || [];
    for (const x of w) wmap.set(x.item_code, x as never);
  }

  return withTags
    .map((n) => {
      const w = wmap.get(n.wine_id) || {};
      return {
        code: n.wine_id,
        name: w.item_name_kr || n.wine_id,
        type: w.wine_type || '',
        country: w.country || '',
        price: Number(w.supply_price) || 0,
        tags: (n.flavor_tags || []).map((k) => flavorLabel(k)),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
}

/** 향미태그 목록을 엑셀(Buffer)로 — 어드민 향미태그 탭 다운로드용. */
export async function generateFlavorTagsExcel(): Promise<Buffer> {
  const { default: ExcelJS } = await import('exceljs');
  const wines = await getFlavorTagsData();

  const wb = new ExcelJS.Workbook();
  wb.creator = 'CavedeVin';
  const ws = wb.addWorksheet('향미태그', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [
    { header: '품번', key: 'code', width: 11 },
    { header: '와인명', key: 'name', width: 42 },
    { header: '타입', key: 'type', width: 10 },
    { header: '국가', key: 'country', width: 12 },
    { header: '공급가', key: 'price', width: 12 },
    { header: '향미 수', key: 'count', width: 8 },
    { header: '향미태그', key: 'tags', width: 70 },
  ];
  const head = ws.getRow(1);
  head.font = { bold: true, size: 10 };
  head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
  for (const w of wines) {
    ws.addRow({
      code: w.code, name: w.name, type: w.type, country: w.country,
      price: w.price || null, count: w.tags.length, tags: w.tags.join(', '),
    });
  }
  ws.getColumn('code').numFmt = '@';
  ws.getColumn('price').numFmt = '#,##0';
  ws.autoFilter = { from: 'A1', to: `G${wines.length + 1}` };

  return Buffer.from(await wb.xlsx.writeBuffer());
}
