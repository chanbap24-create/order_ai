#!/usr/bin/env node
/**
 * 원격 동기화 에이전트
 *
 * 로컬 PC에서 백그라운드로 실행 — 30초마다 서버를 폴링하여
 * 웹에서 요청한 동기화 작업을 자동 실행합니다.
 *
 * 사용법:
 *   node scripts/sync-agent.js
 *   (또는 pm2, launchd 등으로 상시 실행)
 *
 * 종료: Ctrl+C
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// ── 설정 ──
const POLL_INTERVAL = 30_000; // 30초
const API_BASE = process.env.API_BASE || 'https://order-ai-one.vercel.app';
const API_URL = `${API_BASE}/api/admin/remote-sync`;
const SCRIPT_DIR = __dirname;
const PROJECT_DIR = path.join(SCRIPT_DIR, '..');

const log = (msg) => console.log(`[${new Date().toLocaleTimeString('ko-KR')}] ${msg}`);

let isRunning = false;

async function poll() {
  if (isRunning) return;

  try {
    const res = await fetch(`${API_URL}?action=poll`);
    const { request } = await res.json();

    if (!request) return; // 대기 중인 요청 없음

    log(`📥 동기화 요청 감지! (id: ${request.id}, mode: ${request.mode})`);
    isRunning = true;

    // 상태를 'running'으로 업데이트
    await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: request.id, status: 'running' }),
    });

    // auto-download 실행
    const logs = [];
    const downloadedFiles = [];

    try {
      const files = await runAutoDownload(request.mode, logs);
      downloadedFiles.push(...files);
      log(`✅ 다운로드 완료: ${files.length}개 파일`);

      // 다운로드된 파일을 DB에 업로드
      if (files.length > 0) {
        await uploadFiles(files, logs);
        log(`✅ DB 업로드 완료`);
      }

      // 완료 상태 업데이트
      await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: request.id,
          status: 'done',
          logs: logs.join('\n'),
          result: { files: downloadedFiles.length, uploaded: true },
        }),
      });

      log(`✅ 동기화 완료! (${downloadedFiles.length}개 파일)`);
    } catch (err) {
      log(`❌ 동기화 실패: ${err.message}`);
      await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: request.id,
          status: 'error',
          logs: [...logs, `ERROR: ${err.message}`].join('\n'),
        }),
      });
    }
  } catch (err) {
    // 네트워크 에러 등 — 조용히 무시 (다음 폴링에서 재시도)
    if (!err.message?.includes('fetch')) {
      log(`⚠ 폴링 에러: ${err.message}`);
    }
  } finally {
    isRunning = false;
  }
}

function runAutoDownload(mode, logs) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(SCRIPT_DIR, 'auto-download.js');
    const args = [scriptPath, '--headless'];
    if (mode === 'cdv-only') args.push('--cdv-only');
    if (mode === 'dl-only') args.push('--dl-only');

    const child = spawn('node', args, {
      cwd: PROJECT_DIR,
      env: { ...process.env },
    });

    child.stdout.on('data', (chunk) => {
      for (const line of chunk.toString().split('\n').filter(Boolean)) {
        logs.push(line);
        log(`  ${line}`);
      }
    });

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString().trim();
      if (text.includes('Error') || text.includes('error')) {
        logs.push(`STDERR: ${text.slice(0, 200)}`);
      }
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`auto-download 종료 코드: ${code}`));
        return;
      }

      // 다운로드된 파일 목록 수집
      const dlDir = path.join(PROJECT_DIR, 'downloads');
      const files = [];
      if (fs.existsSync(dlDir)) {
        const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        for (const f of fs.readdirSync(dlDir)) {
          if (f.includes(today) && f.endsWith('.xlsx')) files.push(f);
        }
      }
      resolve(files);
    });

    child.on('error', reject);
  });
}

const FILE_KEY_MAP = {
  'cdv-release': 'client',
  'cdv-stock': 'downloads',
  'cdv-payment': 'payments',
  'dl-release': 'dl-client',
  'dl-stock': 'dl',
  'dl-payment': 'dl-payments',
};

async function uploadFiles(files, logs) {
  // 다운로드된 파일을 XLSX 파싱 → Vercel API로 JSON 전송 (로컬 서버 불필요)
  const XLSX = require('xlsx');
  // inventoryHeaders.ts는 TypeScript라 직접 require 불가 — 인라인 정의
  const HEADER_MAP = {
    '품번':'item_no','품명':'item_name','브랜드':'brand','수입사':'importer','용량':'volume_ml',
    '빈티지':'vintage','알콜도수%':'alcohol_content','국가':'country','표준바코드':'barcode',
    '재고수량(A)':'total_stock','재고수량(가용재고제외)(B)':'stock_excl_available','출고예정(C)':'pending_shipment','가용재고(B-C)':'available_stock',
    '재고수량(B)':'total_stock','재고수량(가용재고제외)':'stock_excl_available','출고예정(B)':'pending_shipment','가용재고(A-B)':'available_stock',
    '30일출고':'sales_30days','90일/3평균출고':'avg_sales_90d','365일/12평균출고':'avg_sales_365d',
    '공급가':'supply_price','판매가':'retail_price','할인공급가':'discount_price','도매장가':'wholesale_price','최저판매가':'min_price','미착품재고':'incoming_stock',
    '보세(용마)':'bonded_warehouse','용마로지스':'yongma_logistics','용마(리져브)':'yongma_reserve','용마(마케팅부)':'yongma_marketing','용마(영업1부)':'yongma_sales1','용마(영업2부)':'yongma_sales2','안성창고(CDV)':'anseong_warehouse',
    '보세(GIG)':'bonded_warehouse','안성창고(DL)':'anseong_warehouse','GIG':'gig_warehouse','GIG(마케팅부)':'gig_marketing','GIG(영업1부)':'gig_sales1',
    '안성창고':'anseong_warehouse','GIG마케팅':'gig_marketing','GIG영업1':'gig_sales1',
  };
  const TEXT_COLUMNS = new Set(['item_no','item_name','brand','importer','volume_ml','vintage','alcohol_content','country','barcode']);
  const dlDir = path.join(PROJECT_DIR, 'downloads');

  for (const fileName of files) {
    const key = fileName.replace(/_\d+\.xlsx$/, '');
    const uploadType = FILE_KEY_MAP[key];
    if (!uploadType) {
      logs.push(`SKIP: ${fileName} (알 수 없는 타입)`);
      continue;
    }

    try {
      const filePath = path.join(dlDir, fileName);
      const buffer = fs.readFileSync(filePath);
      const wb = XLSX.read(buffer, { type: 'buffer' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

      // 재고현황: 헤더 기반 파싱 → JSON API 전송
      if (uploadType === 'downloads' || uploadType === 'dl') {
        const headers = rawRows[0].map(v => String(v ?? '').trim());
        const colMap = [];
        for (let idx = 0; idx < headers.length; idx++) {
          const h = headers[idx];
          if (!h) continue;
          const dbCol = HEADER_MAP[h];
          if (dbCol) colMap.push({ idx, dbCol });
        }

        const rows = [];
        for (let i = 1; i < rawRows.length; i++) {
          const r = rawRows[i];
          const obj = {};
          for (const cm of colMap) {
            const raw = r[cm.idx];
            if (TEXT_COLUMNS.has(cm.dbCol)) {
              obj[cm.dbCol] = cm.dbCol === 'item_no'
                ? String(raw ?? '').trim().replace(/\.0$/, '')
                : String(raw ?? '').trim();
            } else {
              if (raw == null) { obj[cm.dbCol] = null; continue; }
              const s = String(raw).replace(/,/g, '').trim();
              const n = Number(s);
              obj[cm.dbCol] = Number.isFinite(n) ? n : null;
            }
          }
          if (!obj.item_no) continue;
          obj.updated_at = new Date().toISOString();
          rows.push(obj);
        }

        // 2000건씩 청크 전송
        const CHUNK = 2000;
        for (let i = 0; i < rows.length; i += CHUNK) {
          const chunk = rows.slice(i, i + CHUNK);
          const res = await fetch(`${API_BASE}/api/admin/remote-sync/upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: uploadType, rows: chunk, append: i > 0 }),
          });
          if (!res.ok) throw new Error(await res.text().then(t => t.slice(0, 200)));
        }
        logs.push(`✓ ${fileName} → ${uploadType} (${rows.length}건)`);
        log(`  ✓ ${fileName} → ${uploadType} (${rows.length}건)`);
        continue;
      }

      // 출고현황/수금내역: 기존 웹 UI와 동일하게 handleUpload 로직을 에이전트에서 수행하기엔 복잡
      // → FormData로 Vercel에 직접 전송 (remote-sync API 경유)
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const formData = new FormData();
      formData.append('file', blob, fileName);
      formData.append('type', uploadType);

      const res = await fetch(`${API_BASE}/api/admin/remote-sync/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error(await res.text().then(t => t.slice(0, 200)));
      const result = await res.json();
      logs.push(`✓ ${fileName} → ${uploadType} (${result.items || result.inserted || '?'}건)`);
      log(`  ✓ ${fileName} → ${uploadType}`);
    } catch (err) {
      logs.push(`✗ ${fileName} 업로드 실패: ${err.message}`);
      log(`  ✗ ${fileName}: ${err.message}`);
    }
  }
}

// ── 메인 루프 ──
log('🔄 원격 동기화 에이전트 시작');
log(`   서버: ${API_BASE}`);
log(`   폴링 간격: ${POLL_INTERVAL / 1000}초`);
log('   종료: Ctrl+C\n');

// 즉시 1회 실행 + 이후 30초 간격
poll();
setInterval(poll, POLL_INTERVAL);

// graceful shutdown
process.on('SIGINT', () => {
  log('\n🛑 에이전트 종료');
  process.exit(0);
});
