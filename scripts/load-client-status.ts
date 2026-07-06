/**
 * 거래처정보(와인) 엑셀을 client_details 로 일괄 적재 — 상태(F열) 포함.
 * 기존 admin 거래처정보 업로드와 동일하되 status 컬럼까지 채운다.
 * 사용: npx -y tsx scripts/load-client-status.ts [파일경로]
 */
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
import * as XLSX from 'xlsx';

/* eslint-disable @typescript-eslint/no-explicit-any */
const clean = (v: unknown): string => {
  const t = String(v ?? '').trim();
  return /^[-\s]*$/.test(t) ? '' : t;
};

async function main() {
  const file = process.argv[2] || '/Users/hajin/Downloads/2026-07-06_113840.xlsx';
  const { supabase } = await import('@/app/lib/db');
  const rows = XLSX.utils.sheet_to_json(XLSX.readFile(file).Sheets['data'], { header: 1, defval: '' }) as any[][];
  const header = (rows[0] || []).map((h: any) => String(h ?? '').trim());
  const col = (n: string) => header.indexOf(n);
  const iCode = col('거래처번호'), iName = col('거래처명'), iBiz = col('업종구분');
  const iMgr = col('영업담당자'), iContact = col('업체담당자');
  const iDeliv = col('납품주소'), iLoc = col('사업장소재지'), iStat = col('상태');
  if (iCode < 0 || iStat < 0) { console.error('거래처번호/상태 열 없음'); process.exit(1); }

  const byCode = new Map<string, any>();
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]; const code = clean(r[iCode]); if (!code) continue;
    byCode.set(code, {
      client_code: code, client_type: 'wine',
      client_name: clean(r[iName]),
      business_type: clean(r[iBiz]) || null,
      manager: clean(r[iMgr]) || null,
      contact_name: clean(r[iContact]) || null,
      address: (clean(r[iDeliv]) || clean(r[iLoc])) || null,
      status: clean(r[iStat]) || null,
      updated_at: new Date().toISOString(),
    });
  }
  const arr = [...byCode.values()];
  console.log('적재 대상:', arr.length);
  let done = 0;
  for (let i = 0; i < arr.length; i += 500) {
    const { error } = await supabase.from('client_details').upsert(arr.slice(i, i + 500), { onConflict: 'client_code' });
    if (error) { console.error('batch error', i, error.message); process.exit(1); }
    done += Math.min(500, arr.length - i);
    process.stdout.write(`\r적재 ${done}/${arr.length}`);
  }
  const { data } = await supabase.from('client_details').select('status').eq('client_type', 'wine');
  const dist: any = {};
  for (const d of (data || [])) dist[d.status || '(null)'] = (dist[d.status || '(null)'] || 0) + 1;
  console.log('\n상태 분포:', JSON.stringify(dist));
}
main();
