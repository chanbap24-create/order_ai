/**
 * 기존 테이스팅 노트(GitHub Release `note`)의 PPTX 를 일괄 파싱해
 * wines 테이블의 빈 칸(item_name_en/region/grape_varieties/country_en/vintage/item_name_kr)을 backfill.
 *
 * AI 조사 없이 업로드된 시스템 템플릿 PPTX 에서 라벨/이름 카드를 역추출한다.
 * 파싱 로직은 런타임 업로드 경로(upload-single)와 동일한 모듈을 재사용.
 *
 * 사용법:
 *   npx -y tsx scripts/backfill-wines-from-notes.ts            # dry-run (쓰기 없음)
 *   npx -y tsx scripts/backfill-wines-from-notes.ts --apply    # 실제 반영
 *   ... --limit 20            # 앞 20개만 (테스트)
 *   ... --concurrency 8       # 동시 다운로드 수 (기본 8)
 *
 * 안전장치:
 *   - 빈 칸만 채움(기존 값 절대 덮어쓰지 않음)
 *   - wines 행이 없는 품번은 스킵
 *   - 빈 칸이 하나도 없는 와인은 다운로드조차 스킵(대역폭 절약)
 *   - 외부 양식 PPTX 는 파서가 {} 반환 → 자동 스킵
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { parseWineFieldsFromPptx, extractBottleImageFromPptx } from "../app/lib/tastingNotePptxParse";
import { syncBottleImageIfEmpty } from "../app/lib/wineBottleImage";

config({ path: ".env.local" });

const REPO_OWNER = "chanbap24-create";
const REPO_NAME = "order_ai";
const RELEASE_TAG = "note";

const TARGET_COLS = [
  "item_name_kr",
  "item_name_en",
  "country_en",
  "region",
  "grape_varieties",
  "vintage",
] as const;
type TargetCol = (typeof TARGET_COLS)[number];

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const LIMIT = numArg("--limit");
const CONCURRENCY = numArg("--concurrency") ?? 8;

function numArg(flag: string): number | undefined {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? Number(args[i + 1]) : undefined;
}

const sb = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
);

const ghHeaders: Record<string, string> = {
  "User-Agent": "order-ai-backfill",
  Accept: "application/vnd.github.v3+json",
};
if (process.env.GITHUB_TOKEN) ghHeaders.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

const isEmpty = (v: unknown) => v == null || String(v).trim() === "";

/** 릴리스의 모든 .pptx 에셋 (name → download url) */
async function listPptxAssets(): Promise<{ itemCode: string; url: string }[]> {
  const base = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`;
  const rel = await fetch(`${base}/releases/tags/${RELEASE_TAG}`, { headers: ghHeaders });
  if (!rel.ok) throw new Error(`release fetch 실패: ${rel.status} ${await rel.text()}`);
  const releaseId = (await rel.json()).id;

  const out: { itemCode: string; url: string }[] = [];
  for (let page = 1; ; page++) {
    const res = await fetch(`${base}/releases/${releaseId}/assets?per_page=100&page=${page}`, {
      headers: ghHeaders,
    });
    if (!res.ok) break;
    const assets: { name: string; browser_download_url: string }[] = await res.json();
    if (!assets.length) break;
    for (const a of assets) {
      if (a.name.toLowerCase().endsWith(".pptx")) {
        out.push({ itemCode: a.name.replace(/\.pptx$/i, ""), url: a.browser_download_url });
      }
    }
    if (assets.length < 100) break;
  }
  return out;
}

/** wines 전체(타깃 컬럼만) 로드 → Map(item_code → row) */
async function loadWines(): Promise<Map<string, Record<string, unknown>>> {
  const map = new Map<string, Record<string, unknown>>();
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from("wines")
      .select(["item_code", "image_url", ...TARGET_COLS].join(", "))
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`wines load 실패: ${error.message}`);
    if (!data || !data.length) break;
    for (const row of data as Record<string, unknown>[]) {
      map.set(String(row.item_code), row);
    }
    if (data.length < PAGE) break;
  }
  return map;
}

/** 간단한 동시성 풀 */
async function pool<T>(items: T[], n: number, fn: (item: T, idx: number) => Promise<void>) {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        await fn(items[idx], idx);
      }
    }),
  );
}

async function main() {
  console.log(`=== wines backfill from release notes (${APPLY ? "APPLY" : "DRY-RUN"}) ===\n`);

  const wines = await loadWines();
  console.log(`wines 로드: ${wines.size}개`);

  let assets = await listPptxAssets();
  console.log(`릴리스 PPTX 에셋: ${assets.length}개`);

  // wines 행 없음 / 빈 칸 없음 → 사전 스킵 (다운로드 절약)
  let noWineRow = 0;
  let alreadyFull = 0;
  assets = assets.filter(({ itemCode }) => {
    const w = wines.get(itemCode);
    if (!w) { noWineRow++; return false; }
    const hasEmpty = TARGET_COLS.some((c) => isEmpty(w[c])) || isEmpty(w.image_url);
    if (!hasEmpty) { alreadyFull++; return false; }
    return true;
  });
  console.log(`  - wines 행 없음(스킵): ${noWineRow}`);
  console.log(`  - 이미 모두 채워짐(스킵): ${alreadyFull}`);
  console.log(`  - 처리 대상: ${assets.length}${LIMIT ? ` (limit ${LIMIT} 적용)` : ""}\n`);

  if (LIMIT) assets = assets.slice(0, LIMIT);

  const stats = {
    downloaded: 0,
    parsedEmpty: 0, // 파싱했지만 채울 게 없음(외부 양식 등)
    filledWines: 0,
    imagesSynced: 0, // 병 이미지 채움(dry-run 은 채울 수 있는 수)
    errors: 0,
    perCol: Object.fromEntries(TARGET_COLS.map((c) => [c, 0])) as Record<TargetCol, number>,
  };
  const updates: { item_code: string; patch: Record<string, string> }[] = [];

  await pool(assets, CONCURRENCY, async ({ itemCode, url }) => {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "order-ai-backfill" } });
      if (!res.ok) throw new Error(`download ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      stats.downloaded++;
      const w = wines.get(itemCode)!;

      // 병 이미지 동기화 (빈 image_url 만)
      if (isEmpty(w.image_url)) {
        if (APPLY) {
          if (await syncBottleImageIfEmpty(sb, itemCode, buf)) stats.imagesSynced++;
        } else if (await extractBottleImageFromPptx(buf)) {
          stats.imagesSynced++; // dry-run: 채울 수 있는 수
        }
      }

      // 필드 backfill
      const fields = await parseWineFieldsFromPptx(buf);
      const patch: Record<string, string> = {};
      for (const c of TARGET_COLS) {
        const v = (fields as Record<string, string | undefined>)[c];
        if (v && isEmpty(w[c])) {
          patch[c] = v;
          stats.perCol[c]++;
        }
      }
      if (Object.keys(patch).length === 0) {
        stats.parsedEmpty++;
        return;
      }
      updates.push({ item_code: itemCode, patch });
      stats.filledWines++;
    } catch (e) {
      stats.errors++;
      console.warn(`  ! ${itemCode}: ${e instanceof Error ? e.message : e}`);
    }
  });

  // 적용
  if (APPLY && updates.length) {
    await pool(updates, CONCURRENCY, async ({ item_code, patch }) => {
      const { error } = await sb.from("wines").update(patch).eq("item_code", item_code);
      if (error) console.warn(`  ! update ${item_code}: ${error.message}`);
    });
  }

  // 리포트
  console.log(`\n=== 결과 ===`);
  console.log(`다운로드: ${stats.downloaded} / 채울 와인: ${stats.filledWines} / 채울 것 없음: ${stats.parsedEmpty} / 에러: ${stats.errors}`);
  console.log(`병 이미지 ${APPLY ? "채움" : "채울 수 있음"}: ${stats.imagesSynced}`);
  console.log(`컬럼별 채움 건수:`);
  for (const c of TARGET_COLS) console.log(`  - ${c}: ${stats.perCol[c]}`);
  if (!APPLY) {
    console.log(`\n(DRY-RUN — 실제 반영하려면 --apply)`);
    console.log(`샘플(최대 10):`);
    for (const u of updates.slice(0, 10)) {
      console.log(`  ${u.item_code}  ${JSON.stringify(u.patch)}`);
    }
  } else {
    console.log(`\n✅ ${updates.length}개 와인 업데이트 완료`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
