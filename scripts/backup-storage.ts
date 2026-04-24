/**
 * Supabase Storage 전체 백업 스크립트.
 *
 * 사용법:
 *   npm run backup:storage
 *
 * 동작:
 *   1) SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 로 모든 bucket 조회
 *   2) 각 bucket 의 모든 object 재귀 리스트 → 로컬 다운로드
 *   3) backups/storage/YYYY-MM-DD/<bucket>/<path> 로 저장
 *   4) manifest.json 에 (name, size, sha256) 기록
 *   5) 30일 초과 백업 디렉터리 자동 삭제 (RETENTION_DAYS)
 *
 * Schedule (macOS launchd): ~/Library/LaunchAgents/com.orderai.backup.plist
 *   → 매일 03:00 자동 실행 (scripts/backup-storage.launchd.plist 참고)
 *
 * 복구 예시:
 *   backups/storage/2026-04-24/expense-files/m_<hex>.enc
 *   → Supabase Dashboard → Storage → expense-files 에 업로드 하거나
 *     aws s3-cp 같은 bulk 업로드 스크립트 필요.
 */

import { createClient } from '@supabase/supabase-js';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { config } from 'dotenv';

config({ path: path.join(process.cwd(), '.env.local') });

const URL = process.env.SUPABASE_URL || '';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BACKUP_ROOT = path.join(process.cwd(), 'backups', 'storage');
const RETENTION_DAYS = 30;
const PAGE_SIZE = 1000;

if (!URL || !KEY) {
  console.error('❌ SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in .env.local');
  process.exit(1);
}

const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

type ObjectEntry = { name: string; size: number; sha256: string };

async function listBuckets(): Promise<string[]> {
  const { data, error } = await supabase.storage.listBuckets();
  if (error) throw error;
  return (data || []).map((b) => b.name);
}

/** 재귀적으로 모든 object 경로 수집 (하위 폴더 포함). */
async function listAllObjects(bucket: string, prefix = ''): Promise<string[]> {
  const out: string[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit: PAGE_SIZE,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const item of data) {
      const full = prefix ? `${prefix}/${item.name}` : item.name;
      // id === null 이면 폴더
      if (item.id === null) {
        const sub = await listAllObjects(bucket, full);
        out.push(...sub);
      } else {
        out.push(full);
      }
    }
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return out;
}

async function downloadObject(
  bucket: string,
  key: string,
  destPath: string,
): Promise<{ size: number; sha256: string }> {
  const { data, error } = await supabase.storage.from(bucket).download(key);
  if (error || !data) throw error || new Error(`empty data: ${bucket}/${key}`);
  const buf = Buffer.from(await data.arrayBuffer());
  await fs.mkdir(path.dirname(destPath), { recursive: true });
  await fs.writeFile(destPath, buf);
  return {
    size: buf.length,
    sha256: crypto.createHash('sha256').update(buf).digest('hex'),
  };
}

async function cleanupOldBackups(): Promise<void> {
  try {
    await fs.mkdir(BACKUP_ROOT, { recursive: true });
    const dirs = await fs.readdir(BACKUP_ROOT);
    const cutoffMs = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
    for (const d of dirs) {
      const full = path.join(BACKUP_ROOT, d);
      const st = await fs.stat(full).catch(() => null);
      if (!st?.isDirectory()) continue;
      if (st.mtimeMs < cutoffMs) {
        await fs.rm(full, { recursive: true, force: true });
        console.log(`  🗑  removed old backup: ${d}`);
      }
    }
  } catch (e) {
    console.warn('cleanup warning:', (e as Error).message);
  }
}

async function main(): Promise<void> {
  const startTs = Date.now();
  const dateStr = new Date().toISOString().slice(0, 10);
  const outDir = path.join(BACKUP_ROOT, dateStr);
  await fs.mkdir(outDir, { recursive: true });

  console.log(`📦 Supabase Storage Backup`);
  console.log(`   URL   : ${URL}`);
  console.log(`   Out   : ${outDir}`);
  console.log(`   Retain: ${RETENTION_DAYS} days`);
  console.log();

  const buckets = await listBuckets();
  console.log(`Buckets: ${buckets.length} → [${buckets.join(', ')}]`);
  if (buckets.length === 0) {
    console.log('⚠  No buckets found. Nothing to back up.');
    return;
  }

  const manifest: {
    date: string;
    supabase_url: string;
    buckets: Record<string, ObjectEntry[]>;
  } = {
    date: dateStr,
    supabase_url: URL,
    buckets: {},
  };

  let totalFiles = 0;
  let totalBytes = 0;

  for (const bucket of buckets) {
    console.log(`\n[${bucket}]`);
    const keys = await listAllObjects(bucket);
    console.log(`  ${keys.length} object(s)`);
    const entries: ObjectEntry[] = [];
    let done = 0;
    for (const key of keys) {
      try {
        const dest = path.join(outDir, bucket, key);
        const { size, sha256 } = await downloadObject(bucket, key, dest);
        entries.push({ name: key, size, sha256 });
        totalBytes += size;
        done += 1;
        if (done % 20 === 0 || done === keys.length) {
          process.stdout.write(`\r  ${done}/${keys.length}`);
        }
      } catch (e) {
        console.error(`\n  skip ${key}: ${(e as Error).message}`);
      }
    }
    if (keys.length > 0) process.stdout.write('\n');
    manifest.buckets[bucket] = entries;
    totalFiles += entries.length;
  }

  await fs.writeFile(
    path.join(outDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
  );

  await cleanupOldBackups();

  const dur = ((Date.now() - startTs) / 1000).toFixed(1);
  const sizeMb = (totalBytes / 1024 / 1024).toFixed(2);
  console.log(`\n✅ Done: ${totalFiles} files, ${sizeMb} MB, ${dur}s`);
}

main().catch((e) => {
  console.error('❌ Backup failed:', e);
  process.exit(1);
});
