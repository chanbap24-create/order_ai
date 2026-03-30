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
  // 로컬 Next.js dev 서버를 띄워서 업로드 (admin 인증 없이 localhost 사용)
  const LOCAL = 'http://localhost:3000';

  // dev 서버 체크
  let localOk = false;
  try {
    const r = await fetch(`${LOCAL}/api/sync-inventory`, { method: 'GET' });
    localOk = r.ok;
  } catch { /* not running */ }

  // dev 서버가 없으면 임시로 시작
  let devServer = null;
  if (!localOk) {
    log('  로컬 서버 시작 중...');
    devServer = spawn('npx', ['next', 'dev', '-p', '3000'], {
      cwd: PROJECT_DIR,
      env: { ...process.env },
      stdio: 'ignore',
      detached: true,
    });
    // 서버 준비 대기 (최대 30초)
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 1000));
      try {
        const r = await fetch(`${LOCAL}/api/sync-inventory`);
        if (r.ok) { localOk = true; break; }
      } catch { /* not ready */ }
    }
    if (!localOk) {
      logs.push('✗ 로컬 서버 시작 실패');
      if (devServer) { devServer.kill(); }
      return;
    }
    log('  로컬 서버 준비 완료');
  }

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
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      const formData = new FormData();
      formData.append('file', blob, fileName);

      // 로컬 서버로 업로드 (인증 불필요)
      const res = await fetch(`${LOCAL}/api/admin/upload/${uploadType}`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(err.slice(0, 200));
      }

      logs.push(`✓ ${fileName} → ${uploadType} 업로드 완료`);
      log(`  ✓ ${fileName} → ${uploadType}`);
    } catch (err) {
      logs.push(`✗ ${fileName} 업로드 실패: ${err.message}`);
      log(`  ✗ ${fileName}: ${err.message}`);
    }
  }

  // 임시로 시작한 dev 서버 종료
  if (devServer) {
    log('  로컬 서버 종료');
    devServer.kill();
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
