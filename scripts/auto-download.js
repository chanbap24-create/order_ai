/**
 * ABCosmos 자동 다운로드 스크립트
 *
 * 6개 파일을 자동으로 다운로드:
 *   CDV(와인): 출고현황, 재고, 수금내역
 *   DL(글라스): 출고현황, 재고, 수금내역
 *
 * 사용법: node scripts/auto-download.js
 * 옵션:
 *   --headless  브라우저 숨김 모드
 *   --cdv-only  CDV(와인)만
 *   --dl-only   DL(글라스)만
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// ── 설정 ──
const EMAIL = process.env.ABCOSMOS_EMAIL || '01029953931@cavedevin.com';
const PASSWORD = process.env.ABCOSMOS_PASSWORD || 'ruddud0526!@';
const DOWNLOAD_DIR = path.join(__dirname, '..', 'downloads');
const BASE_URL = 'https://www.abcosmos.com';

const ARGS = process.argv.slice(2);
const HEADLESS = ARGS.includes('--headless');
const CDV_ONLY = ARGS.includes('--cdv-only');
const DL_ONLY = ARGS.includes('--dl-only');

// 현재 활성 엔티티 추적 (로그인 시 CDV가 기본)
let currentEntity = 'CDV';

// ── 다운로드 대상 페이지 ──
const PAGES = [
  // CDV (와인) - 기본 엔티티이므로 먼저
  { key: 'cdv-release',  entity: 'CDV', type: 'release', label: '와인 출고현황',
    url: '/kr/main/logistics/sales/pgmMetaSLRelease' },
  { key: 'cdv-stock',    entity: 'CDV', type: 'stock',   label: '와인 재고현황',
    url: '/kr/main/logistics/stock/pgmMetaLGStockSLV2' },
  { key: 'cdv-payment',  entity: 'CDV', type: 'payment', label: '수금내역(Wine)',
    url: '/kr/main/logistics/sales/pgmMetaSLAccountBookMonthly' },
  // DL (글라스) - 엔티티 전환 후
  { key: 'dl-release',   entity: 'DL',  type: 'release', label: '글라스 출고현황',
    url: '/kr/main/logistics/sales/pgmMetaSLRelease' },
  { key: 'dl-stock',     entity: 'DL',  type: 'stock',   label: '글라스 재고현황',
    url: '/kr/main/logistics/stock/pgmMetaLGStockSLV2' },
  { key: 'dl-payment',   entity: 'DL',  type: 'payment', label: '수금내역(DL)',
    url: '/kr/main/logistics/sales/pgmMetaSLAccountBookMonthly' },
];

// ── 유틸 ──
function today() { return new Date().toISOString().slice(0, 10); }
function weekLater() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}
function firstOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
function log(msg) {
  const ts = new Date().toLocaleTimeString('ko-KR');
  console.log(`[${ts}] ${msg}`);
}

// ── 메인 ──
(async () => {
  if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

  log('ABCosmos 자동 다운로드 시작');

  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    acceptDownloads: true,
    permissions: [],               // 알림 권한 요청 차단
  });
  const page = await context.newPage();

  // 알림 권한 다이얼로그 자동 닫기
  page.on('dialog', async dialog => {
    log(`  [다이얼로그] ${dialog.type()}: ${dialog.message().slice(0, 50)}`);
    await dialog.dismiss();
  });

  try {
    // ── 1. 로그인 ──
    log('로그인 중...');
    await page.goto(`${BASE_URL}/kr/login`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    const loginInputs = await page.$$('input');
    if (loginInputs.length < 2) throw new Error('로그인 input을 찾을 수 없습니다.');

    await loginInputs[0].fill(EMAIL);
    await loginInputs[1].fill(PASSWORD);
    await page.click('button:has-text("로그인")');
    await page.waitForTimeout(5000);

    if (page.url().includes('/login')) throw new Error('로그인 실패');
    log('로그인 성공 (현재 엔티티: CDV)');
    currentEntity = 'CDV';

    // ── 2. 필터링 ──
    let targets = PAGES;
    if (CDV_ONLY) targets = targets.filter(p => p.entity === 'CDV');
    if (DL_ONLY) targets = targets.filter(p => p.entity === 'DL');

    // ── 3. CDV 먼저, DL은 별도 세션으로 ──
    const cdvTargets = targets.filter(p => p.entity === 'CDV');
    const dlTargets = targets.filter(p => p.entity === 'DL');
    const results = {};

    // CDV 다운로드
    for (const config of cdvTargets) {
      log(`\n─── ${config.label} ───`);
      try {
        await page.goto(`${BASE_URL}${config.url}`, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(3000);

        // 권한 요청 등 팝업 다이얼로그 자동 닫기
        await dismissPopups(page);

        // 조회 조건 설정
        await setQueryConditions(page, config);

        // 조회 클릭 (headless에서도 안정적으로 동작하도록 evaluate 방식)
        const clicked = await page.evaluate(() => {
          const buttons = document.querySelectorAll('button');
          for (const btn of buttons) {
            if (btn.textContent?.trim() === '조회') {
              btn.click();
              return true;
            }
          }
          return false;
        });
        if (!clicked) {
          // 폴백: Playwright 셀렉터
          await page.click('button:has-text("조회")', { timeout: 10000 });
        }
        log('  조회 → 데이터 로딩 대기...');
        await page.waitForTimeout(10000);

        // 데이터 확인
        const cellCount = await page.evaluate(() =>
          document.querySelectorAll('.ht_master td').length
        );
        log(`  데이터 셀: ${cellCount}`);

        if (cellCount === 0) {
          log('  ⚠ 데이터 없음, 건너뜀');
          results[config.key] = { success: false, reason: '데이터 없음' };
          continue;
        }

        // 엑셀 다운로드
        const filePath = await downloadXLSX(page, config.key);
        if (filePath) {
          // 출고현황: 다운로드된 파일이 올바른 엔티티인지 검증
          if (config.type === 'release') {
            const XLSX = require('xlsx');
            const vwb = XLSX.readFile(filePath);
            const vws = vwb.Sheets[vwb.SheetNames[0]];
            const vrows = XLSX.utils.sheet_to_json(vws, { header: 1, defval: '' });
            const warehouses = new Set();
            for (let vi = 1; vi < Math.min(50, vrows.length); vi++) {
              const wh = String(vrows[vi]?.[23] || '').trim();
              if (wh) warehouses.add(wh);
            }
            const whText = [...warehouses].join('|');
            const isCDV = whText.includes('용마') || whText.includes('CDV');
            const isDL = whText.includes('GIG') || whText.includes('DL');
            const expected = config.entity;
            if ((expected === 'CDV' && !isCDV && isDL) || (expected === 'DL' && !isDL && isCDV)) {
              log(`  ⚠ 엔티티 불일치! 기대: ${expected}, 실제 창고: ${whText}`);
              log(`  ⚠ 이 파일은 건너뜁니다 (잘못된 엔티티 데이터)`);
              results[config.key] = { success: false, reason: `엔티티 불일치 (${whText})` };
              continue;
            }
          }
          log(`  ✓ ${path.basename(filePath)}`);
          results[config.key] = { success: true, filePath };
        } else {
          log('  ✗ 다운로드 실패');
          results[config.key] = { success: false, reason: '다운로드 실패' };
        }
      } catch (err) {
        log(`  ✗ 에러: ${err.message}`);
        results[config.key] = { success: false, reason: err.message };
        await page.screenshot({ path: path.join(DOWNLOAD_DIR, `error-${config.key}.png`) });
      }
    }

    // ── DL: 완전히 새 브라우저 컨텍스트로 재로그인 ──
    if (dlTargets.length > 0) {
      log('\n═══ DL 세션 시작 (새 브라우저 세션) ═══');
      // 기존 페이지 닫고 새 컨텍스트 생성
      await page.close();
      await context.close();
      context = await browser.newContext({ acceptDownloads: true });
      page = await context.newPage();

      // DL로 새로 로그인
      await page.goto(`${BASE_URL}/kr/login`, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(2000);
      await page.fill('input[type="text"], input[name="email"]', EMAIL);
      await page.fill('input[type="password"]', PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(5000);
      log('  DL 세션 로그인 완료');

      // 엔티티 전환
      await switchEntity(page, 'DL');
      currentEntity = 'DL';

      for (const config of dlTargets) {
        log(`\n─── ${config.label} ───`);
        try {
          await page.goto(`${BASE_URL}${config.url}`, { waitUntil: 'networkidle', timeout: 30000 });
          await page.waitForTimeout(3000);

          await dismissPopups(page);
          await setQueryConditions(page, config);

          const clicked = await page.evaluate(() => {
            const buttons = document.querySelectorAll('button');
            for (const btn of buttons) {
              if (btn.textContent?.trim() === '조회') { btn.click(); return true; }
            }
            return false;
          });
          if (!clicked) await page.click('button:has-text("조회")', { timeout: 10000 });
          log('  조회 → 데이터 로딩 대기...');
          await page.waitForTimeout(7000);

          const cellCount = await page.evaluate(() => document.querySelectorAll('.ht_master td').length);
          log(`  데이터 셀: ${cellCount}`);

          if (cellCount === 0) {
            log('  ⚠ 데이터 없음, 건너뜀');
            results[config.key] = { success: false, reason: '데이터 없음' };
            continue;
          }

          const filePath = await downloadXLSX(page, config.key);
          if (filePath) {
            // 출고현황: 파일 검증
            if (config.type === 'release') {
              const XLSX = require('xlsx');
              const vwb = XLSX.readFile(filePath);
              const vws = vwb.Sheets[vwb.SheetNames[0]];
              const vrows = XLSX.utils.sheet_to_json(vws, { header: 1, defval: '' });
              const warehouses = new Set();
              for (let vi = 1; vi < Math.min(50, vrows.length); vi++) {
                const wh = String(vrows[vi]?.[23] || '').trim();
                if (wh) warehouses.add(wh);
              }
              const whText = [...warehouses].join('|');
              if ((whText.includes('용마') || whText.includes('CDV')) && !whText.includes('GIG') && !whText.includes('DL')) {
                log(`  ⚠ 1차 조회에서 CDV 데이터 감지 — 페이지 새로고침 후 재조회`);
                // 페이지 새로고침 → 재조회 → 재다운로드
                await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
                await page.waitForTimeout(3000);
                await dismissPopups(page);
                await setQueryConditions(page, config);
                await page.evaluate(() => {
                  for (const btn of document.querySelectorAll('button')) {
                    if (btn.textContent?.trim() === '조회') { btn.click(); return; }
                  }
                });
                log('  재조회 → 데이터 로딩 대기...');
                await page.waitForTimeout(10000);

                // 재다운로드
                const retryPath = await downloadXLSX(page, config.key);
                if (retryPath) {
                  const rwb = XLSX.readFile(retryPath);
                  const rws = rwb.Sheets[rwb.SheetNames[0]];
                  const rrows = XLSX.utils.sheet_to_json(rws, { header: 1, defval: '' });
                  const rWH = new Set();
                  for (let ri = 1; ri < Math.min(50, rrows.length); ri++) {
                    const w = String(rrows[ri]?.[23] || '').trim();
                    if (w) rWH.add(w);
                  }
                  const rWhText = [...rWH].join('|');
                  if ((rWhText.includes('용마') || rWhText.includes('CDV')) && !rWhText.includes('GIG')) {
                    log(`  ✗ 재시도에도 CDV 데이터 (${rWhText}) — 스킵`);
                    results[config.key] = { success: false, reason: `재시도 후에도 CDV 데이터` };
                    continue;
                  }
                  log(`  ✓ 재시도 성공! 창고: ${rWhText}`);
                  results[config.key] = { success: true, filePath: retryPath };
                  continue;
                }
                results[config.key] = { success: false, reason: '재시도 다운로드 실패' };
                continue;
              }
            }
            log(`  ✓ ${path.basename(filePath)}`);
            results[config.key] = { success: true, filePath };
          } else {
            log('  ✗ 다운로드 실패');
            results[config.key] = { success: false, reason: '다운로드 실패' };
          }
        } catch (err) {
          log(`  ✗ 에러: ${err.message}`);
          results[config.key] = { success: false, reason: err.message };
          await page.screenshot({ path: path.join(DOWNLOAD_DIR, `error-${config.key}.png`) });
        }
      }
    }

    // ── 4. 결과 요약 ──
    log('\n═══ 결과 ═══');
    const success = Object.values(results).filter(r => r.success).length;
    const total = Object.keys(results).length;
    for (const config of targets) {
      const r = results[config.key];
      if (!r) continue;
      const icon = r.success ? '✓' : '✗';
      const detail = r.success ? path.basename(r.filePath) : r.reason;
      log(`  ${icon} ${config.label}: ${detail}`);
    }
    log(`\n${success}/${total} 성공`);

  } catch (err) {
    log(`치명적 에러: ${err.message}`);
    await page.screenshot({ path: path.join(DOWNLOAD_DIR, 'fatal-error.png') });
  } finally {
    await browser.close();
    log('완료');
  }
})();

// ══════════════════════════════════════════
// 엔티티 전환 (프로필 아이콘 팝업 방식)
// ══════════════════════════════════════════
async function switchEntity(page, targetEntity) {
  const targetName = targetEntity === 'DL' ? '대유라이프' : '까브드뱅';
  log(`  엔티티 전환: ${currentEntity} → ${targetEntity}`);

  // 1) 프로필 아이콘 클릭 (좌상단 ~40,40)
  await page.mouse.click(40, 40);
  await page.waitForTimeout(2000);

  // 2) 현재 엔티티명 클릭 → 선택지 펼치기
  //    TreeWalker로 텍스트 요소 찾기
  const entities = await page.evaluate(() => {
    const items = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const text = walker.currentNode.textContent?.trim();
      if (text && (text.includes('까브드뱅') || text.includes('대유라이프'))) {
        const el = walker.currentNode.parentElement;
        const rect = el?.getBoundingClientRect();
        if (rect && rect.width > 0) {
          items.push({
            text: text.slice(0, 60),
            tag: el.tagName,
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            w: Math.round(rect.width),
            h: Math.round(rect.height),
          });
        }
      }
    }
    return items;
  });

  // H5 태그 (현재 엔티티 헤더) 클릭
  const header = entities.find(e => e.tag === 'H5');
  if (header) {
    await page.mouse.click(header.x + 10, header.y + header.h / 2);
    await page.waitForTimeout(2000);
  }

  // 3) 대상 엔티티 클릭
  const afterEntities = await page.evaluate(() => {
    const items = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const text = walker.currentNode.textContent?.trim();
      if (text && (text.includes('까브드뱅') || text.includes('대유라이프'))) {
        const el = walker.currentNode.parentElement;
        const rect = el?.getBoundingClientRect();
        if (rect && rect.width > 0) {
          items.push({
            text: text.slice(0, 60),
            tag: el.tagName,
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            h: Math.round(rect.height),
          });
        }
      }
    }
    return items;
  });

  const target = afterEntities.find(e => e.text.includes(targetName) && e.tag === 'P');
  if (target) {
    await page.mouse.click(target.x + 10, target.y + target.h / 2);
    await page.waitForTimeout(5000);

    // 엔티티 전환 확정: 충분히 대기 후 페이지 새로고침
    await page.waitForTimeout(5000);
    await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    currentEntity = targetEntity;
    log(`  ✓ 엔티티 전환 완료: ${targetEntity}`);
  } else {
    throw new Error(`엔티티 "${targetName}" 옵션을 찾을 수 없음`);
  }
}

// ══════════════════════════════════════════
// 팝업/다이얼로그 자동 닫기
// ══════════════════════════════════════════
async function dismissPopups(page) {
  // MUI 다이얼로그 (권한 요청, 알림 등) 확인 버튼 클릭
  const closed = await page.evaluate(() => {
    let count = 0;
    // MUI Dialog의 확인/닫기 버튼
    document.querySelectorAll('[role="dialog"] button, .MuiDialog-root button, .MuiModal-root button').forEach(btn => {
      const text = btn.textContent?.trim();
      if (text === '확인' || text === '닫기' || text === 'OK' || text === 'Close') {
        btn.click();
        count++;
      }
    });
    // X 닫기 버튼
    document.querySelectorAll('[role="dialog"] [aria-label="close"], [role="dialog"] .MuiIconButton-root').forEach(btn => {
      btn.click();
      count++;
    });
    return count;
  });
  if (closed > 0) {
    log(`  팝업 ${closed}개 닫음`);
    await page.waitForTimeout(500);
  }
}

// ══════════════════════════════════════════
// 조회 조건 설정
// ══════════════════════════════════════════
async function setQueryConditions(page, config) {
  if (config.type === 'release') {
    // 출고현황: 완료제외 체크박스가 켜져있으면 해제 (완료건 포함해서 전체 조회)
    const needsUncheck = await page.evaluate(() => {
      const labels = document.querySelectorAll('label, span');
      for (const l of labels) {
        if (l.textContent?.includes('완료제외')) {
          const cb = l.querySelector('input[type="checkbox"]')
            || l.closest('label')?.querySelector('input[type="checkbox"]');
          if (cb && cb.checked) return true;
        }
      }
      return false;
    });

    if (needsUncheck) {
      log('  완료제외 체크 해제 (전체 조회)');
      await page.evaluate(() => {
        const labels = document.querySelectorAll('label, span');
        for (const l of labels) {
          if (l.textContent?.includes('완료제외')) {
            const cb = l.querySelector('input[type="checkbox"]')
              || l.closest('label')?.querySelector('input[type="checkbox"]');
            if (cb) cb.click();
            break;
          }
        }
      });
      await page.waitForTimeout(500);
    }

    // 종료일을 7일 후로 변경 (출고 예정 포함)
    const endDate = weekLater();
    const dateInfo = await page.evaluate((end) => {
      // 모든 input 필드 수집
      const allInputs = document.querySelectorAll('input');
      const candidates = [];
      for (const inp of allInputs) {
        const val = (inp.value || '').replace(/\s/g, '');
        // 날짜 형식: YYYY-MM-DD, YYYY.MM.DD, YYYYMMDD, YYYY/MM/DD
        if (/^\d{4}[-./]?\d{2}[-./]?\d{2}$/.test(val)) {
          candidates.push({ val, type: inp.type, placeholder: inp.placeholder });
        }
      }
      if (candidates.length < 2) return { found: false, candidates };

      // 종료일 = 두번째 날짜 input
      let idx = 0;
      for (const inp of allInputs) {
        const val = (inp.value || '').replace(/\s/g, '');
        if (/^\d{4}[-./]?\d{2}[-./]?\d{2}$/.test(val)) {
          idx++;
          if (idx === 2) {
            // 기존 날짜 형식 유지 (구분자 동일하게)
            const sep = val.includes('-') ? '-' : val.includes('.') ? '.' : val.includes('/') ? '/' : '';
            const parts = end.split('-');
            const formatted = sep ? parts.join(sep) : parts.join('');

            // React 호환 값 설정
            const nativeSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
            nativeSet.call(inp, formatted);
            inp.dispatchEvent(new Event('input', { bubbles: true }));
            inp.dispatchEvent(new Event('change', { bubbles: true }));
            // blur 이벤트도 트리거 (React DatePicker 호환)
            inp.dispatchEvent(new Event('blur', { bubbles: true }));
            return { found: true, oldVal: val, newVal: formatted, candidates };
          }
        }
      }
      return { found: false, candidates };
    }, endDate);

    if (dateInfo.found) {
      log(`  종료일 변경: ${dateInfo.oldVal} → ${dateInfo.newVal}`);
      await page.waitForTimeout(500);
    } else {
      log(`  ⚠ 날짜 필드를 찾을 수 없음 (후보: ${JSON.stringify(dateInfo.candidates)})`);
    }

    log(`  조회 기간: ${firstOfMonth()} ~ ${endDate}`);
  } else if (config.type === 'stock') {
    log('  재고 조회 (기준일: 오늘)');
  } else if (config.type === 'payment') {
    log(`  수금 조회 기간: ${firstOfMonth()} ~ ${today()}`);
  }
}

// ══════════════════════════════════════════
// 엑셀 다운로드 (우클릭 → Download XLSX)
// ══════════════════════════════════════════
async function downloadXLSX(page, key) {
  // 1) Handsontable 데이터 영역 좌표 가져오기
  const tableRect = await page.evaluate(() => {
    let best = null;
    document.querySelectorAll('.handsontable').forEach(ht => {
      const tds = ht.querySelectorAll('.ht_master td');
      if (tds.length > 0) {
        const rect = ht.getBoundingClientRect();
        if (!best || tds.length > best.cells) {
          best = { x: rect.x, y: rect.y, w: rect.width, h: rect.height, cells: tds.length };
        }
      }
    });
    return best;
  });

  if (!tableRect) {
    log('  ⚠ Handsontable을 찾을 수 없음');
    return null;
  }

  // 2) 다운로드 이벤트 리스너 먼저 설정
  const downloadPromise = page.waitForEvent('download', { timeout: 30000 }).catch(() => null);

  // 3) 데이터 영역에 우클릭 (좌표 기반)
  const clickX = tableRect.x + Math.min(300, tableRect.w / 3);
  const clickY = tableRect.y + Math.min(150, tableRect.h / 4);
  await page.mouse.click(clickX, clickY, { button: 'right' });
  await page.waitForTimeout(2000);

  // 4) "Download XLSX" 메뉴 아이템 클릭 (mousedown/mouseup/click 이벤트)
  const clicked = await page.evaluate(() => {
    const allTds = document.querySelectorAll('td');
    for (const td of allTds) {
      if (td.textContent?.trim() === 'Download XLSX') {
        td.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        td.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        td.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        return true;
      }
    }
    return false;
  });

  if (!clicked) {
    log('  ⚠ "Download XLSX" 메뉴 없음');
    await page.screenshot({ path: path.join(DOWNLOAD_DIR, `no-menu-${key}.png`) });
    return null;
  }

  // 5) 다운로드 완료 대기
  const download = await downloadPromise;
  if (!download) {
    log('  ⚠ 다운로드 이벤트 타임아웃');
    return null;
  }

  const ts = today().replace(/-/g, '');
  const fileName = `${key}_${ts}.xlsx`;
  const filePath = path.join(DOWNLOAD_DIR, fileName);
  await download.saveAs(filePath);
  return filePath;
}
