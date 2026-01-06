// app/lib/searchLearning.ts
import { db } from "@/app/lib/db";

/** ✅ search_key: 띄어쓰기/기호/수량/단위/따옴표 제거 + 소문자 */
export function normalizeForSearch(raw: string) {
  let s = String(raw || "");

  // 줄바꿈/탭 정리
  s = s.replace(/\r/g, "").replace(/\t/g, " ");

  // 따옴표 제거
  s = s.replace(/["'`]/g, "");

  // 수량/단위 제거 (뒤쪽/중간 모두 어느 정도 안전하게)
  // ex) "몬테 6병", "몬테 6 bt", "몬테 6bt", "몬테 2cs"
  s = s.replace(/\b(\d+)\s*(병|박스|cs|box|bt|btl|ea|pcs|case|케이스)\b/gi, " ");
  s = s.replace(/\b(\d+)\b/g, " "); // 수량만 남은 숫자도 제거(빈티지 2019 같은 건 남기고 싶으면 여기서 예외처리 가능)

  // 기호/구두점 제거
  s = s.replace(/[()\-_/.,:;|\\[\]{}<>!?~@#$%^&*=+]/g, " ");

  // 공백 정리 후 "공백 제거 키"로
  s = s.toLowerCase().replace(/\s+/g, " ").trim();
  s = s.replace(/\s+/g, ""); // 최종적으로 공백 제거

  return s;
}

export function ensureSearchLearningTable() {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS search_learning (
      search_key TEXT NOT NULL,
      item_no TEXT NOT NULL,
      hit_count INTEGER DEFAULT 1,
      last_used_at TEXT DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (search_key, item_no)
    )
  `).run();

  // 조회 최적화 (있으면 좋음)
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_search_learning_key ON search_learning(search_key)`).run();
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_search_learning_item ON search_learning(item_no)`).run();
}

/** ✅ 후보 클릭 시 누적 */
export function upsertSearchLearning(rawInput: string, itemNo: string) {
  ensureSearchLearningTable();

  const key = normalizeForSearch(rawInput);
  const item_no = String(itemNo || "").trim();
  if (!key || !item_no) return { ok: false, reason: "empty" };

  const info = db.prepare(`
    INSERT INTO search_learning(search_key, item_no, hit_count)
    VALUES (?, ?, 1)
    ON CONFLICT(search_key, item_no) DO UPDATE SET
      hit_count = hit_count + 1,
      last_used_at = CURRENT_TIMESTAMP
  `).run(key, item_no);

  return { ok: true, changes: info.changes, search_key: key };
}

/**
 * ✅ resolve 단계에서 보너스 조회
 * - exact key
 * - contains (양방향): key 포함 / 포함되는 key
 *   (너무 과하게 매칭하면 위험하니 길이 제한)
 */
export function getSearchLearningBonuses(rawInput: string, limit = 30) {
  ensureSearchLearningTable();

  const qkey = normalizeForSearch(rawInput);
  if (!qkey) return [];

  // 너무 짧으면 학습 매칭 의미 없음 (오탐 방지)
  if (qkey.length < 6) return [];

  // 1) exact
  const exact = db.prepare(`
    SELECT item_no, hit_count
    FROM search_learning
    WHERE search_key = ?
    ORDER BY hit_count DESC, last_used_at DESC
    LIMIT ?
  `).all(qkey, limit) as Array<{ item_no: string; hit_count: number }>;

  // 2) contains (양방향) - 제한적으로
  const like = db.prepare(`
    SELECT item_no, hit_count
    FROM search_learning
    WHERE
      ( ? LIKE '%' || search_key || '%' AND length(search_key) >= 8 )
      OR
      ( search_key LIKE '%' || ? || '%' AND length(?) >= 10 )
    ORDER BY hit_count DESC, last_used_at DESC
    LIMIT ?
  `).all(qkey, qkey, qkey, limit) as Array<{ item_no: string; hit_count: number }>;

  // 합치기(최대 hit_count 사용)
  const map = new Map<string, number>();
  for (const r of [...exact, ...like]) {
    const prev = map.get(String(r.item_no)) ?? 0;
    map.set(String(r.item_no), Math.max(prev, Number(r.hit_count || 0)));
  }

  // item_no별 bonus 산출
  // hit_count가 누적될수록 bonus 증가 (하지만 상한)
  const out = Array.from(map.entries()).map(([item_no, hit]) => {
    const h = Math.max(1, hit);
    const bonus = Math.min(0.35, 0.10 + Math.log1p(h) * 0.08); // 1회≈0.155, 3회≈0.23, 10회≈0.29
    return { item_no, hit_count: h, bonus };
  });

  // bonus 큰 순
  out.sort((a, b) => b.bonus - a.bonus);
  return out;
}
