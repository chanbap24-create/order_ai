/**
 * ERP 거래처 명부로 shipments.client_code(null) 백필 + client_details 등록.
 *   미리보기(기본): 매칭 결과를 backfill-preview.html + 콘솔 요약. DB 미변경.
 *   적용(--apply): shipments UPDATE + client_details UPSERT.
 * 사용: npx -y tsx scripts/backfill-clientcodes.ts [--file <xlsx>] [--apply]
 * CDV(shipments/wine)만 대상. 이름 정확일치 + 정규화일치, 애매/미매칭은 제외(수동).
 */
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
import * as XLSX from 'xlsx';
import { writeFileSync } from 'fs';
/* eslint-disable @typescript-eslint/no-explicit-any */
const norm = (s: string) => (s || '').replace(/주식회사|유한회사|합자회사|합동회사|㈜|\(주\)|주\)/g, '').replace(/\s+/g, '').toLowerCase().trim();
const esc = (s: string) => String(s || '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));

async function main() {
  const argv = process.argv.slice(2);
  const apply = argv.includes('--apply');
  const fi = argv.indexOf('--file');
  const file = fi >= 0 && argv[fi + 1] ? argv[fi + 1] : '/Users/hajin/Downloads/2026-07-03_120157.xlsx';
  const { supabase } = await import('@/app/lib/db');

  // ERP: 코드 → 정보 · 이름 → 코드 인덱스
  const rows = XLSX.utils.sheet_to_json(XLSX.readFile(file).Sheets['data'], { header: 1, defval: '' }) as any[][];
  const erp = new Map<string, { name: string; mgr: string; upjong: string }>();
  const exact = new Map<string, Set<string>>(); const normal = new Map<string, Set<string>>();
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]; const code = String(r[2] || '').trim(); if (!code) continue;
    erp.set(code, { name: String(r[3] || '').trim(), mgr: String(r[11] || '').trim(), upjong: String(r[9] || '').trim() });
    for (const nm of [String(r[3] || '').trim(), String(r[4] || '').trim()]) {
      if (!nm) continue;
      (exact.get(nm) || exact.set(nm, new Set()).get(nm)!).add(code);
      const nn = norm(nm); if (nn) (normal.get(nn) || normal.set(nn, new Set()).get(nn)!).add(code);
    }
  }

  // null-code 출고 이름별
  const byName = new Map<string, { rows: number; mgr: string }>();
  for (let off = 0; off < 500000; off += 1000) {
    const { data } = await supabase.from('shipments').select('client_name, manager').is('client_code', null).range(off, off + 999);
    if (!data || !data.length) break;
    for (const s of data as any[]) { const n = (s.client_name || '').trim(); if (!n) continue; const e = byName.get(n) || { rows: 0, mgr: s.manager || '' }; e.rows++; if (s.manager) e.mgr = s.manager; byName.set(n, e); }
    if (data.length < 1000) break;
  }

  // 현재 client_details 전체(PK=client_code 단독): 코드 → {이름, 타입}. glass 충돌 판정용.
  const cd = new Map<string, { name: string; type: string }>();
  for (let off = 0; off < 100000; off += 1000) {
    const { data } = await supabase.from('client_details').select('client_code, client_name, client_type').range(off, off + 999);
    if (!data || !data.length) break;
    for (const r of data as any[]) cd.set(String(r.client_code), { name: r.client_name || '', type: r.client_type || '' });
    if (data.length < 1000) break;
  }

  type M = { name: string; code: string; erpName: string; mgr: string; upjong: string; rows: number; how: string; action: string; conflict: string };
  const matched: M[] = []; const ambig: string[] = []; const none: { name: string; rows: number }[] = [];
  for (const [name, info] of byName) {
    let code = '', how = '';
    const ex = exact.get(name);
    if (ex && ex.size === 1) { code = [...ex][0]; how = '정확'; }
    else if (ex && ex.size > 1) { ambig.push(`${name}(${info.rows}행→${[...ex].join(',')})`); continue; }
    else { const nn = normal.get(norm(name)); if (nn && nn.size === 1) { code = [...nn][0]; how = '정규화'; } else if (nn && nn.size > 1) { ambig.push(`${name}(정규화 다중)`); continue; } else { none.push({ name, rows: info.rows }); continue; } }
    const e = erp.get(code)!;
    const existing = cd.get(code);
    let action: string; let conflict = '';
    if (!existing) action = '신규등록+코드';
    else if (existing.type === 'wine') { action = '출고코드만'; if (existing.name !== e.name) conflict = `⚠ 기존wine:${existing.name}`; }
    else { action = 'glass충돌-제외'; conflict = `⛔ 기존glass:${existing.name}`; }
    matched.push({ name, code, erpName: e.name, mgr: e.mgr || info.mgr, upjong: e.upjong, rows: info.rows, how, action, conflict });
  }
  matched.sort((a, b) => b.rows - a.rows);

  const newReg = matched.filter((m) => m.action === '신규등록+코드').length;
  const wineExist = matched.filter((m) => m.action === '출고코드만').length;
  const glassCol = matched.filter((m) => m.action === 'glass충돌-제외').length;
  const conflicts = matched.filter((m) => m.action === '출고코드만' && m.conflict).length;
  const totRows = matched.reduce((a, b) => a + b.rows, 0);
  console.log(`\n[백필 미리보기]${apply ? ' → 적용모드' : ''}`);
  console.log(`  매칭 ${matched.length}곳 (${totRows}행) · 정확 ${matched.filter(m=>m.how==='정확').length}·정규화 ${matched.filter(m=>m.how==='정규화').length}`);
  console.log(`  신규 client_details 생성: ${newReg}곳 · 이미 wine등록(출고코드만): ${wineExist}곳`);
  console.log(`  ⛔ glass 충돌(제외): ${glassCol}곳 ${glassCol ? '← DL 코드와 겹쳐 건너뜀' : ''}`);
  console.log(`  wine 이름불일치(참고): ${conflicts}곳`);
  console.log(`  제외 — 애매(다중): ${ambig.length}곳 · 미매칭: ${none.length}곳\n`);
  const mgrDist = new Map<string, number>(); for (const m of matched) mgrDist.set(m.mgr || '-', (mgrDist.get(m.mgr || '-') || 0) + 1);
  console.log('  담당자별:', [...mgrDist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k} ${v}`).join(' · '));
  console.log('\n  상위 12(출고 많은 순):');
  for (const m of matched.slice(0, 12)) console.log(`   ${m.name} → ${m.code} · ${m.action} · ${m.rows}행 · ${m.mgr}${m.conflict ? ' ' + m.conflict : ''}`);
  if (conflicts) { console.log('\n  ⚠ 충돌:'); for (const m of matched.filter(x => x.conflict).slice(0, 10)) console.log(`   ${m.name} → ${m.code} · ${m.conflict}`); }

  // HTML 전체 목록
  const badge = (a: string) => a === '신규등록+코드' ? '<b style="color:#0891b2">신규</b>' : a === 'glass충돌-제외' ? '<b style="color:#dc2626">glass제외</b>' : '기존';
  const tr = (m: M) => `<tr${m.conflict ? ' style="background:#fff5f5"' : ''}><td>${esc(m.name)}</td><td class="mono">${m.code}</td><td>${badge(m.action)}</td><td class="r">${m.rows}</td><td>${esc(m.mgr)}</td><td>${esc(m.upjong)}</td><td>${m.how}</td><td style="color:#dc2626">${esc(m.conflict)}</td></tr>`;
  const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>거래처코드 백필 미리보기</title><style>body{font-family:-apple-system,'Apple SD Gothic Neo',sans-serif;margin:0;background:#f7f5f3;color:#1f2430;padding:24px 16px 80px}.wrap{max-width:1000px;margin:0 auto}h1{font-size:22px}.sub{color:#6b7280;font-size:13px;margin-bottom:16px}table{width:100%;border-collapse:collapse;font-size:12.5px;background:#fff;border:1px solid #e7e3df;border-radius:8px}th,td{text-align:left;padding:6px 9px;border-bottom:1px solid #eee}th{color:#6b7280;font-size:11px;position:sticky;top:0;background:#faf9f8}.r{text-align:right}.mono{font-family:Menlo,monospace}h2{font-size:14px;margin-top:22px}</style></head><body><div class="wrap">
<h1>거래처코드 백필 미리보기</h1><div class="sub">ERP 명부 매칭 · 매칭 ${matched.length}곳(${totRows}행) · 신규등록 ${newReg} · 충돌 ${conflicts} · 애매 ${ambig.length} · 미매칭 ${none.length} · 2026-07-03</div>
<table><tr><th>출고 거래처명</th><th>코드</th><th>구분</th><th class="r">출고행</th><th>담당</th><th>업종</th><th>매칭</th><th>충돌</th></tr>${matched.map(tr).join('')}</table>
<h2>제외 — 애매(다중코드) ${ambig.length}곳</h2><div class="sub">${ambig.map(esc).join(' · ') || '-'}</div>
<h2>제외 — 미매칭 ${none.length}곳 (대부분 /사업자변경·/폐업)</h2><div class="sub">${none.sort((a,b)=>b.rows-a.rows).map(n=>esc(`${n.name}(${n.rows})`)).join(' · ') || '-'}</div>
</div></body></html>`;
  writeFileSync('backfill-preview.html', html);
  console.log('\n→ backfill-preview.html 작성 (전체 목록)');

  if (apply) {
    console.log('\n=== 적용 시작 (glass충돌 제외) ===');
    // 1) 신규 client_details 생성(코드 중복 제거, PK=client_code라 insert). 기존 행은 절대 안 건드림.
    const toCreate = new Map<string, { client_code: string; client_name: string; client_type: string; importance: number; manager: string }>();
    for (const m of matched) if (m.action === '신규등록+코드' && !toCreate.has(m.code)) toCreate.set(m.code, { client_code: m.code, client_name: m.erpName, client_type: 'wine', importance: 3, manager: m.mgr });
    const createArr = [...toCreate.values()]; let reg = 0;
    for (let i = 0; i < createArr.length; i += 300) {
      const { error } = await supabase.from('client_details').insert(createArr.slice(i, i + 300));
      if (error) console.error('  client_details insert 오류:', error.message); else reg += Math.min(300, createArr.length - i);
    }
    // 2) 출고코드 채움 — 신규+wine기존만(glass충돌 제외)
    let up = 0;
    for (const m of matched) {
      if (m.action === 'glass충돌-제외') continue;
      const { error } = await supabase.from('shipments').update({ client_code: m.code }).is('client_code', null).eq('client_name', m.name);
      if (!error) up++;
      if (up % 100 === 0) process.stdout.write(`  출고 ${up}\r`);
    }
    console.log(`\n✅ 완료: client_details 신규 ${reg}곳 · 출고코드 채운 거래처 ${up}곳 · glass충돌 건너뜀 ${matched.filter(m=>m.action==='glass충돌-제외').length}곳`);
  } else {
    console.log('(미리보기 — DB 미변경. --apply 로 적용)');
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error('FAIL:', e); process.exit(1); });
