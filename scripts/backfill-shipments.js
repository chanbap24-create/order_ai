// 임포트된 shipments 데이터 정리:
// 1. 정확한 이름 매칭 → client_code 채우기
// 2. 매칭 안 되는 거래처 → 신규 client_details 생성
// 3. DL 데이터 → glass_shipments로 이동

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const BATCH = 500;

async function main() {
  console.log('=== Shipments Backfill ===\n');

  // 1. client_details 전체 로드 (name → code 매핑)
  const { data: cd } = await sb.from('client_details').select('client_code, client_name, client_type, manager');
  const nameToCode = new Map();
  const nameToType = new Map();
  const nameToManager = new Map();
  for (const c of cd) {
    nameToCode.set(c.client_name, c.client_code);
    nameToType.set(c.client_name, c.client_type);
    nameToManager.set(c.client_name, c.manager);
  }
  console.log(`client_details: ${cd.length}개 로드`);

  // 2. client_code가 null인 임포트 데이터의 고유 거래처명+warehouse 수집
  const unmatchedNames = new Map(); // name → { warehouse, manager, count }
  let matchedCount = 0;
  let from = 0;

  // 먼저 고유 거래처명 수집
  const allClients = new Map(); // name → { warehouse, manager, count }
  while (true) {
    const { data } = await sb.from('shipments')
      .select('client_name, warehouse, manager')
      .is('client_code', null)
      .range(from, from + 999);
    if (!data || data.length === 0) break;
    for (const r of data) {
      if (!allClients.has(r.client_name)) {
        allClients.set(r.client_name, { warehouse: r.warehouse, manager: r.manager || '', count: 0 });
      }
      allClients.get(r.client_name).count++;
    }
    if (data.length < 1000) break;
    from += 1000;
  }
  console.log(`임포트 고유 거래처: ${allClients.size}개`);

  // 3. 정확히 매칭되는 것 → client_code 업데이트
  console.log('\n--- Step 1: 정확한 이름 매칭으로 client_code 채우기 ---');
  let updated = 0;
  for (const [name, info] of allClients) {
    if (nameToCode.has(name)) {
      const code = nameToCode.get(name);
      // 배치로 업데이트
      const { error, count } = await sb.from('shipments')
        .update({ client_code: code })
        .is('client_code', null)
        .eq('client_name', name);
      if (error) {
        console.error(`  매칭 업데이트 실패 [${name}]:`, error.message);
      } else {
        updated++;
        matchedCount += info.count;
      }
    } else {
      unmatchedNames.set(name, info);
    }
    if (updated % 100 === 0 && updated > 0) {
      process.stdout.write(`  ${updated}개 거래처 매칭 완료...\r`);
    }
  }
  console.log(`  매칭 완료: ${updated}개 거래처 (${matchedCount}건)`);

  // 4. 매칭 안 되는 거래처 → 신규 client_details 생성 + client_code 채우기
  console.log(`\n--- Step 2: 미매칭 ${unmatchedNames.size}개 거래처 신규 생성 ---`);
  let created = 0;
  let codeIdx = 1;

  for (const [name, info] of unmatchedNames) {
    // 코드 생성: H + 5자리 (H00001~)
    const newCode = `H${String(codeIdx).padStart(5, '0')}`;
    codeIdx++;

    // DL(glass) warehouse면 glass, 아니면 wine
    const clientType = info.warehouse === 'DL' ? 'glass' : 'wine';

    // client_details 생성
    const { error: cdErr } = await sb.from('client_details').upsert({
      client_code: newCode,
      client_name: name,
      client_type: clientType,
      importance: 3,
      manager: info.manager || '',
    }, { onConflict: 'client_code' });

    if (cdErr) {
      console.error(`  생성 실패 [${name}]:`, cdErr.message);
      continue;
    }

    // shipments에 client_code 채우기
    const { error: upErr } = await sb.from('shipments')
      .update({ client_code: newCode })
      .is('client_code', null)
      .eq('client_name', name);

    if (upErr) {
      console.error(`  코드 업데이트 실패 [${name}]:`, upErr.message);
    } else {
      created++;
    }

    if (created % 200 === 0 && created > 0) {
      process.stdout.write(`  ${created}/${unmatchedNames.size} 생성 완료...\r`);
    }
  }
  console.log(`  신규 생성 완료: ${created}개 거래처`);

  // 5. DL 데이터를 glass_shipments로 이동
  console.log('\n--- Step 3: DL 데이터 → glass_shipments 이동 ---');
  let moved = 0;
  let dlFrom = 0;

  while (true) {
    const { data: dlRows, error: dlErr } = await sb.from('shipments')
      .select('*')
      .eq('warehouse', 'DL')
      .range(dlFrom, dlFrom + BATCH - 1);

    if (dlErr) { console.error('DL 조회 오류:', dlErr.message); break; }
    if (!dlRows || dlRows.length === 0) break;

    // glass_shipments에 삽입 (id 제외)
    const inserts = dlRows.map(r => {
      const { id, ...rest } = r;
      return rest;
    });

    const { error: insErr } = await sb.from('glass_shipments').insert(inserts);
    if (insErr) {
      console.error('glass_shipments 삽입 오류:', insErr.message);
      break;
    }

    // shipments에서 삭제
    const ids = dlRows.map(r => r.id);
    const { error: delErr } = await sb.from('shipments').delete().in('id', ids);
    if (delErr) {
      console.error('shipments 삭제 오류:', delErr.message);
      break;
    }

    moved += dlRows.length;
    if (moved % 5000 === 0) {
      console.log(`  ${moved}건 이동...`);
    }

    // DL 행이 삭제되므로 range 그대로 유지
  }
  console.log(`  DL 이동 완료: ${moved}건`);

  // 6. 최종 확인
  console.log('\n=== 최종 결과 ===');
  const { count: shipCount } = await sb.from('shipments').select('*', { count: 'exact', head: true });
  const { count: glassCount } = await sb.from('glass_shipments').select('*', { count: 'exact', head: true });
  const { count: cdCount } = await sb.from('client_details').select('*', { count: 'exact', head: true });
  const { count: nullCount } = await sb.from('shipments').select('*', { count: 'exact', head: true }).is('client_code', null);

  console.log(`shipments: ${shipCount}건 (client_code null: ${nullCount})`);
  console.log(`glass_shipments: ${glassCount}건`);
  console.log(`client_details: ${cdCount}개`);
}

main().catch(console.error);
